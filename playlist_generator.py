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


def _resolve_track_ids(sp, playlist: list[dict]) -> tuple[list[str], list[str]]:
    track_ids, skipped = [], []
    for item in playlist:
        results = sp.search(q=f"{item['song']} {item['artist']}", type="track", limit=10)
        tracks = results["tracks"]["items"]
        if not tracks:
            skipped.append(f"{item['song']} — {item['artist']}")
        else:
            track_ids.append(tracks[0]["id"])
    return track_ids, skipped


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

    track_ids, skipped = _resolve_track_ids(sp, playlist)

    if not track_ids:
        raise RuntimeError("No tracks could be found on Spotify for any of the generated songs.")

    created = sp.user_playlist_create(
        current_user["id"],
        name=playlist_name,
        public=False,
    )
    sp.user_playlist_add_tracks(current_user["id"], created["id"], track_ids)

    return len(track_ids), skipped


def add_songs_with_token(
    playlist_name: str,
    playlist: list[dict],
    access_token: str,
) -> tuple[int, list[str], str]:
    sp = spotipy.Spotify(auth=access_token)

    try:
        current_user = sp.current_user()
    except spotipy.SpotifyException as e:
        raise RuntimeError(f"Spotify authentication failed — invalid token. ({e})") from e

    track_ids, skipped = _resolve_track_ids(sp, playlist)

    if not track_ids:
        raise RuntimeError("No tracks could be found on Spotify for any of the generated songs.")

    created = sp.user_playlist_create(current_user["id"], name=playlist_name, public=False)
    sp.user_playlist_add_tracks(current_user["id"], created["id"], track_ids)
    playlist_url = created["external_urls"]["spotify"]

    return len(track_ids), skipped, playlist_url
