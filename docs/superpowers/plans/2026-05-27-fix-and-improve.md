# SpotifyPlaylistGenerator Fix & Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all known bugs and code quality issues, then add a smarter CLI, song preview, and a Streamlit web UI.

**Architecture:** Extract shared logic into `playlist_generator.py` so both the CLI (`app.py`) and the web UI (`web_app.py`) use the same core. Use the OpenAI v1.x SDK. Replace fragile error paths with explicit checks.

**Tech Stack:** Python 3.10+, openai>=1.0.0, spotipy>=2.23.0, python-dotenv, streamlit>=1.28.0

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `requirements.txt` | Pinned dependencies |
| Create | `.gitignore` | Exclude `.env`, `env/`, caches |
| Create | `playlist_generator.py` | `get_playlist()` + `add_songs_to_spotify()` — shared core logic |
| Rewrite | `app.py` | CLI entry point only; delegates to `playlist_generator` |
| Create | `web_app.py` | Streamlit web UI |

---

## Task 1: Add `.gitignore` and `requirements.txt`

**Files:**
- Create: `.gitignore`
- Create: `requirements.txt`

- [ ] **Step 1: Create `.gitignore`**

```
.env
env/
__pycache__/
*.pyc
.cache/
.spotify_cache/
```

- [ ] **Step 2: Create `requirements.txt`**

```
openai>=1.0.0
spotipy>=2.23.0
python-dotenv>=1.0.0
streamlit>=1.28.0
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore requirements.txt
git commit -m "chore: add .gitignore and requirements.txt"
```

---

## Task 2: Extract core logic to `playlist_generator.py`

**Files:**
- Create: `playlist_generator.py`

- [ ] **Step 1: Create `playlist_generator.py` with updated OpenAI v1.x API and safe Spotify search**

```python
import json
import openai
import spotipy
from dotenv import dotenv_values

config = dotenv_values(".env")


def get_playlist(prompt: str, count: int = 8) -> list[dict]:
    client = openai.OpenAI(api_key=config["OPENAI_API_KEY"])

    example_json = """[
    {"song": "The Sound of Silence", "artist": "Simon & Garfunkel"},
    {"song": "Hurt", "artist": "Johnny Cash"},
    {"song": "Creep", "artist": "Radiohead"}
    ]"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful playlist generating assistant. "
                "Return ONLY a JSON array where each element is: "
                '{"song": <title>, "artist": <artist>}. No extra text.'
            ),
        },
        {
            "role": "user",
            "content": "Generate a playlist of 3 songs based on this prompt: super sad songs",
        },
        {"role": "assistant", "content": example_json},
        {
            "role": "user",
            "content": f"Generate a playlist of {count} songs based on this prompt: {prompt}",
        },
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=max(400, count * 30),
    )

    return json.loads(response.choices[0].message.content)


def add_songs_to_spotify(
    playlist_name: str, playlist: list[dict]
) -> tuple[int, list[str]]:
    sp = spotipy.Spotify(
        auth_manager=spotipy.SpotifyOAuth(
            client_id=config["SPOTIFY_CLIENT_ID"],
            client_secret=config["SPOTIFY_CLIENT_SECRET"],
            redirect_uri="http://localhost:9999",
            scope="playlist-modify-private",
        )
    )

    current_user = sp.current_user()
    if current_user is None:
        raise RuntimeError("Spotify authentication failed — check your credentials.")

    track_ids = []
    skipped = []

    for item in playlist:
        artist, song = item["artist"], item["song"]
        results = sp.search(q=f"{song} {artist}", type="track", limit=10)
        tracks = results["tracks"]["items"]
        if not tracks:
            skipped.append(f"{song} — {artist}")
            continue
        track_ids.append(tracks[0]["id"])

    if not track_ids:
        raise RuntimeError("No tracks could be found on Spotify for any of the generated songs.")

    created = sp.user_playlist_create(
        current_user["id"],
        name=playlist_name,
        public=False,
    )
    sp.user_playlist_add_tracks(current_user["id"], created["id"], track_ids)

    return len(track_ids), skipped
```

- [ ] **Step 2: Commit**

```bash
git add playlist_generator.py
git commit -m "feat: extract core logic into playlist_generator.py with OpenAI v1.x and safe Spotify search"
```

---

## Task 3: Rewrite `app.py` as a clean CLI

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Replace `app.py` content**

```python
import argparse
from playlist_generator import get_playlist, add_songs_to_spotify


def main():
    parser = argparse.ArgumentParser(description="Generate a Spotify playlist from a text prompt")
    parser.add_argument("-p", type=str, default="My Generated Playlist",
                        help="Describe the playlist (e.g. 'upbeat 90s workout songs')")
    parser.add_argument("-n", type=int, default=8,
                        help="Number of songs (1–50)")
    parser.add_argument("-g", type=str, default="",
                        help="Genre filter (e.g. 'jazz', 'hip-hop')")
    parser.add_argument("-d", type=str, default="",
                        help="Decade filter (e.g. '90s', '2000s')")
    parser.add_argument("-m", type=str, default="",
                        help="Mood filter (e.g. 'upbeat', 'melancholic')")
    parser.add_argument("--yes", action="store_true",
                        help="Skip confirmation and add songs immediately")
    args = parser.parse_args()

    if not 1 <= args.n <= 50:
        raise ValueError("n must be between 1 and 50")

    prompt_parts = [args.p]
    if args.g:
        prompt_parts.append(f"genre: {args.g}")
    if args.d:
        prompt_parts.append(f"decade: {args.d}")
    if args.m:
        prompt_parts.append(f"mood: {args.m}")
    full_prompt = ", ".join(prompt_parts)

    print(f"\nGenerating {args.n} songs for: \"{full_prompt}\"...\n")
    playlist = get_playlist(full_prompt, args.n)

    print("Songs to add:")
    for i, item in enumerate(playlist, 1):
        print(f"  {i:2}. {item['song']} — {item['artist']}")

    if not args.yes:
        confirm = input("\nAdd these to Spotify? [y/N] ").strip().lower()
        if confirm != "y":
            print("Cancelled.")
            return

    print("\nAdding to Spotify...")
    added, skipped = add_songs_to_spotify(args.p, playlist)

    if skipped:
        print(f"\nSkipped ({len(skipped)} not found on Spotify):")
        for s in skipped:
            print(f"  - {s}")

    print(f"\nCreated playlist \"{args.p}\" with {added} songs.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add app.py
git commit -m "feat: rewrite CLI with preview, confirmation, genre/decade/mood flags, and main guard"
```

---

## Task 4: Add Streamlit web UI

**Files:**
- Create: `web_app.py`

- [ ] **Step 1: Create `web_app.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add web_app.py
git commit -m "feat: add Streamlit web UI with genre/decade/mood filters and song preview"
```

---

## Task 5: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# Spotify Playlist Generator

Generate Spotify playlists from a text prompt using GPT-4o.

## Setup

1. Copy `.env.example` to `.env` and fill in your keys:
   ```
   OPENAI_API_KEY=sk-...
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Web UI (recommended)
```bash
streamlit run web_app.py
```

### CLI
```bash
# Basic
python app.py -p "rainy day indie folk"

# With filters
python app.py -p "workout" -g "hip-hop" -d "2010s" -m "energetic" -n 15

# Skip confirmation prompt
python app.py -p "chill beats" --yes
```

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-p` | Playlist description (required) | `My Generated Playlist` |
| `-n` | Number of songs (1–50) | `8` |
| `-g` | Genre filter | — |
| `-d` | Decade filter | — |
| `-m` | Mood filter | — |
| `--yes` | Skip confirmation | false |
```

- [ ] **Step 2: Create `.env.example`**

```
OPENAI_API_KEY=sk-...
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: update README with setup instructions and CLI reference"
```

---

## Self-Review

**Spec coverage:**
- [x] OpenAI v1.x API fix → Task 2, `get_playlist()`
- [x] Song-not-found crash → Task 2, `add_songs_to_spotify()` skips missing tracks
- [x] max_tokens too small → Task 2, `max(400, count * 30)` scales with song count
- [x] No `if __name__ == "__main__":` guard → Task 3
- [x] No requirements.txt → Task 1
- [x] No .gitignore → Task 1
- [x] Fragile assert → Task 2, replaced with RuntimeError
- [x] Model not pinned → Task 2, `gpt-4o`
- [x] Show results before adding → Task 3 (CLI), Task 4 (web)
- [x] Smarter prompt flags (genre/decade/mood) → Tasks 3 & 4
- [x] Web UI → Task 4

**Type consistency check:** `get_playlist()` returns `list[dict]` with `"song"` and `"artist"` keys — all callers in Tasks 3 and 4 use exactly those keys. `add_songs_to_spotify()` returns `tuple[int, list[str]]` — both callers unpack `added, skipped` correctly.
