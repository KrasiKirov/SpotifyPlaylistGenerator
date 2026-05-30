from fastapi.testclient import TestClient
from unittest.mock import patch
import pytest
import spotipy


def test_generate_returns_tracks():
    from api import app
    client = TestClient(app)

    mock_tracks = [
        {"song": "Creep", "artist": "Radiohead"},
        {"song": "Hurt", "artist": "Johnny Cash"},
    ]
    with patch("api.get_playlist", return_value=mock_tracks):
        resp = client.post("/generate", json={"prompt": "sad songs", "count": 2})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["tracks"]) == 2
    assert data["tracks"][0] == {"song": "Creep", "artist": "Radiohead"}


def test_generate_rejects_count_zero():
    from api import app
    client = TestClient(app)
    resp = client.post("/generate", json={"prompt": "songs", "count": 0})
    assert resp.status_code == 422


def test_generate_rejects_count_over_50():
    from api import app
    client = TestClient(app)
    resp = client.post("/generate", json={"prompt": "songs", "count": 51})
    assert resp.status_code == 422


def test_generate_builds_full_prompt():
    from api import app
    client = TestClient(app)
    captured = {}

    def fake_get_playlist(prompt, count):
        captured["prompt"] = prompt
        return [{"song": "Test", "artist": "Artist"}]

    with patch("api.get_playlist", side_effect=fake_get_playlist):
        client.post("/generate", json={
            "prompt": "workout", "count": 1, "genre": "hip-hop", "decade": "90s",
        })

    assert "genre: hip-hop" in captured["prompt"]
    assert "decade: 90s" in captured["prompt"]


def test_generate_returns_500_on_openai_error():
    from api import app
    client = TestClient(app)
    with patch("api.get_playlist", side_effect=RuntimeError("OpenAI down")):
        resp = client.post("/generate", json={"prompt": "sad songs"})
    assert resp.status_code == 500
    assert resp.json()["detail"] == "Playlist generation failed."


def test_generate_includes_mood_in_prompt():
    from api import app
    client = TestClient(app)
    captured = {}

    def fake_get_playlist(prompt, count):
        captured["prompt"] = prompt
        return [{"song": "Test", "artist": "Artist"}]

    with patch("api.get_playlist", side_effect=fake_get_playlist):
        client.post("/generate", json={"prompt": "workout", "count": 1, "mood": "energetic"})

    assert "mood: energetic" in captured["prompt"]


def test_generate_rejects_empty_prompt():
    from api import app
    client = TestClient(app)
    resp = client.post("/generate", json={"prompt": ""})
    assert resp.status_code == 422


def test_add_to_spotify_success():
    from api import app
    client = TestClient(app)

    with patch("api.add_songs_with_token", return_value=(3, [], "https://open.spotify.com/playlist/abc")):
        resp = client.post("/add-to-spotify", json={
            "playlist_name": "Test Playlist",
            "tracks": [
                {"song": "A", "artist": "B"},
                {"song": "C", "artist": "D"},
                {"song": "E", "artist": "F"},
            ],
            "spotify_token": "fake_token",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["added_count"] == 3
    assert data["skipped"] == []
    assert data["playlist_url"] == "https://open.spotify.com/playlist/abc"


def test_add_to_spotify_with_skipped():
    from api import app
    client = TestClient(app)

    with patch("api.add_songs_with_token", return_value=(2, ["Ghost — Unknown"], "https://open.spotify.com/playlist/abc")):
        resp = client.post("/add-to-spotify", json={
            "playlist_name": "Test",
            "tracks": [{"song": "A", "artist": "B"}, {"song": "Ghost", "artist": "Unknown"}],
            "spotify_token": "token",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["added_count"] == 2
    assert "Ghost — Unknown" in data["skipped"]


def test_add_to_spotify_invalid_token():
    from api import app
    client = TestClient(app)

    exc = spotipy.SpotifyException(http_status=401, code=-1, msg="Unauthorized")
    with patch("api.add_songs_with_token", side_effect=exc):
        resp = client.post("/add-to-spotify", json={
            "playlist_name": "Test",
            "tracks": [{"song": "A", "artist": "B"}],
            "spotify_token": "bad_token",
        })

    assert resp.status_code == 401


def test_generate_rejects_oversized_prompt():
    from api import app
    client = TestClient(app)
    resp = client.post("/generate", json={"prompt": "x" * 5000, "count": 5})
    assert resp.status_code == 422


def test_add_to_spotify_rejects_too_many_tracks():
    from api import app
    client = TestClient(app)
    tracks = [{"song": f"s{i}", "artist": f"a{i}"} for i in range(51)]
    resp = client.post("/add-to-spotify", json={
        "playlist_name": "Test",
        "tracks": tracks,
        "spotify_token": "tok",
    })
    assert resp.status_code == 422


def test_generate_returns_502_on_value_error():
    from api import app
    client = TestClient(app)
    with patch("api.get_playlist", side_effect=ValueError("malformed")):
        resp = client.post("/generate", json={"prompt": "sad songs"})
    assert resp.status_code == 502


def test_oversized_body_rejected():
    from api import app
    client = TestClient(app)
    huge = {"prompt": "x" * 100, "padding": "y" * 200_000}
    resp = client.post("/generate", json=huge)
    assert resp.status_code == 413
