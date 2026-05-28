import streamlit as st
from playlist_generator import get_playlist, add_songs_to_spotify

st.set_page_config(page_title="Spotify Playlist Generator", page_icon="🎵")
st.title("Spotify Playlist Generator")
st.caption("Describe a vibe — get a playlist added to your Spotify.")

with st.form("playlist_form"):
    prompt = st.text_input("Describe your playlist", placeholder="e.g. upbeat 90s workout songs")
    col1, col2, col3 = st.columns(3)
    genre = col1.text_input("Genre (optional)", placeholder="jazz")
    decade = col2.text_input("Decade (optional)", placeholder="90s")
    mood = col3.text_input("Mood (optional)", placeholder="upbeat")
    count = st.slider("Number of songs", min_value=1, max_value=50, value=8)
    submitted = st.form_submit_button("Generate")

if submitted:
    if not prompt:
        st.error("Please enter a playlist description.")
        st.stop()

    prompt_parts = [prompt]
    if genre:
        prompt_parts.append(f"genre: {genre}")
    if decade:
        prompt_parts.append(f"decade: {decade}")
    if mood:
        prompt_parts.append(f"mood: {mood}")
    full_prompt = ", ".join(prompt_parts)

    with st.spinner("Asking AI for song ideas..."):
        try:
            playlist = get_playlist(full_prompt, count)
        except Exception as e:
            st.error(f"Failed to generate playlist: {e}")
            st.stop()

    st.subheader("Generated songs")
    for i, item in enumerate(playlist, 1):
        st.write(f"**{i}.** {item['song']} — {item['artist']}")

    st.session_state["pending_playlist"] = playlist
    st.session_state["pending_name"] = prompt

if "pending_playlist" in st.session_state:
    if st.button("Add to Spotify", type="primary"):
        with st.spinner("Adding to Spotify..."):
            try:
                added, skipped = add_songs_to_spotify(
                    st.session_state["pending_name"],
                    st.session_state["pending_playlist"],
                )
            except Exception as e:
                st.error(f"Spotify error: {e}")
                st.stop()

        st.success(f"Created playlist **\"{st.session_state['pending_name']}\"** with {added} songs.")
        if skipped:
            with st.expander(f"{len(skipped)} songs not found on Spotify"):
                for s in skipped:
                    st.write(f"- {s}")

        del st.session_state["pending_playlist"]
        del st.session_state["pending_name"]
