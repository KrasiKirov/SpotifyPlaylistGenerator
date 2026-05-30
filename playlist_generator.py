import json
import os
from typing import Optional

import openai
import spotipy
from dotenv import dotenv_values

OPENAI_TIMEOUT_SECONDS = 30
SPOTIPY_TIMEOUT_SECONDS = 15

_openai_client: Optional[openai.OpenAI] = None


def _get_openai_client() -> openai.OpenAI:
    global _openai_client
    if _openai_client is None:
        config = {**dotenv_values(".env"), **os.environ}
        api_key = config.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        _openai_client = openai.OpenAI(api_key=api_key, timeout=OPENAI_TIMEOUT_SECONDS)
    return _openai_client


def get_playlist(prompt: str, count: int = 8) -> list[dict]:
    example_json = (
        '{"tracks": ['
        '{"song": "The Sound of Silence", "artist": "Simon & Garfunkel"},'
        '{"song": "Hurt", "artist": "Johnny Cash"},'
        '{"song": "Creep", "artist": "Radiohead"}'
        ']}'
    )

    messages = [
        {
            "role": "system",
            "content": (
                'You are a helpful playlist generating assistant. '
                'Return ONLY a JSON object of shape '
                '{"tracks": [{"song": <title>, "artist": <artist>}, ...]}. '
                "No extra text."
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

    response = _get_openai_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=messages,
        max_tokens=max(400, count * 30),
        response_format={"type": "json_object"},
    )

    try:
        data = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError as e:
        raise ValueError(f"OpenAI returned malformed JSON: {e}") from e

    tracks = data.get("tracks") if isinstance(data, dict) else None
    if not isinstance(tracks, list) or not tracks:
        raise ValueError("OpenAI response missing 'tracks' array.")

    cleaned: list[dict] = []
    for item in tracks:
        if not isinstance(item, dict):
            continue
        song = item.get("song")
        artist = item.get("artist")
        if isinstance(song, str) and isinstance(artist, str) and song and artist:
            cleaned.append({"song": song, "artist": artist})

    if not cleaned:
        raise ValueError("OpenAI returned no usable tracks.")

    return cleaned


def _resolve_track_ids(sp, playlist: list[dict]) -> tuple[list[str], list[str]]:
    track_ids: list[str] = []
    seen: set[str] = set()
    skipped: list[str] = []
    for item in playlist:
        results = sp.search(q=f"{item['song']} {item['artist']}", type="track", limit=1)
        tracks = results["tracks"]["items"]
        if not tracks:
            skipped.append(f"{item['song']} — {item['artist']}")
            continue
        tid = tracks[0]["id"]
        if tid in seen:
            continue
        seen.add(tid)
        track_ids.append(tid)
    return track_ids, skipped


def _create_playlist_with_tracks(sp, playlist_name: str, playlist: list[dict]):
    current_user = sp.current_user()
    if current_user is None:
        raise RuntimeError("Spotify authentication failed.")

    track_ids, skipped = _resolve_track_ids(sp, playlist)
    if not track_ids:
        raise RuntimeError("No tracks could be found on Spotify for any of the generated songs.")

    created = sp.user_playlist_create(current_user["id"], name=playlist_name, public=False)
    sp.user_playlist_add_tracks(current_user["id"], created["id"], track_ids)
    return len(track_ids), skipped, created["external_urls"]["spotify"]


def add_songs_to_spotify(playlist_name: str, playlist: list[dict]) -> tuple[int, list[str]]:
    config = {**dotenv_values(".env"), **os.environ}
    sp = spotipy.Spotify(
        auth_manager=spotipy.SpotifyOAuth(
            client_id=config["SPOTIFY_CLIENT_ID"],
            client_secret=config["SPOTIFY_CLIENT_SECRET"],
            redirect_uri="http://localhost:9999",
            scope="playlist-modify-private",
        ),
        requests_timeout=SPOTIPY_TIMEOUT_SECONDS,
    )
    added, skipped, _ = _create_playlist_with_tracks(sp, playlist_name, playlist)
    return added, skipped


def add_songs_with_token(
    playlist_name: str,
    playlist: list[dict],
    access_token: str,
) -> tuple[int, list[str], str]:
    sp = spotipy.Spotify(auth=access_token, requests_timeout=SPOTIPY_TIMEOUT_SECONDS)
    try:
        return _create_playlist_with_tracks(sp, playlist_name, playlist)
    except spotipy.SpotifyException:
        raise
