from unittest.mock import MagicMock, patch
import pytest
import playlist_generator
from playlist_generator import add_songs_with_token, get_playlist


def _stub_openai_response(content: str):
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    client = MagicMock()
    client.chat.completions.create.return_value = resp
    return client


def test_get_playlist_rejects_non_json():
    client = _stub_openai_response("not json at all")
    with patch.object(playlist_generator, "_get_openai_client", return_value=client):
        with pytest.raises(ValueError):
            get_playlist("sad songs", 3)


def test_get_playlist_rejects_missing_tracks_key():
    client = _stub_openai_response('{"songs": []}')
    with patch.object(playlist_generator, "_get_openai_client", return_value=client):
        with pytest.raises(ValueError):
            get_playlist("sad songs", 3)


def test_get_playlist_rejects_empty_tracks():
    client = _stub_openai_response('{"tracks": []}')
    with patch.object(playlist_generator, "_get_openai_client", return_value=client):
        with pytest.raises(ValueError):
            get_playlist("sad songs", 3)


def test_get_playlist_filters_malformed_items():
    client = _stub_openai_response(
        '{"tracks": ['
        '{"song": "Hurt", "artist": "Johnny Cash"},'
        '{"song": null, "artist": "X"},'
        '{"song": "Creep", "artist": "Radiohead"}'
        ']}'
    )
    with patch.object(playlist_generator, "_get_openai_client", return_value=client):
        result = get_playlist("sad songs", 3)
    assert result == [
        {"song": "Hurt", "artist": "Johnny Cash"},
        {"song": "Creep", "artist": "Radiohead"},
    ]


def test_resolve_track_ids_dedupes():
    mock_sp = MagicMock()
    mock_sp.current_user.return_value = {"id": "user123"}
    mock_sp.search.side_effect = [
        {"tracks": {"items": [{"id": "same"}]}},
        {"tracks": {"items": [{"id": "same"}]}},
    ]
    mock_sp.user_playlist_create.return_value = {
        "id": "p1",
        "external_urls": {"spotify": "https://open.spotify.com/playlist/abc"},
    }
    with patch("playlist_generator.spotipy.Spotify", return_value=mock_sp):
        added, skipped, _ = add_songs_with_token(
            "Dupes",
            [{"song": "Creep", "artist": "Radiohead"},
             {"song": "Creep", "artist": "Radiohead"}],
            "token",
        )
    assert added == 1
    mock_sp.user_playlist_add_tracks.assert_called_once_with("user123", "p1", ["same"])


def test_returns_added_count_and_url():
    mock_sp = MagicMock()
    mock_sp.current_user.return_value = {"id": "user123"}
    mock_sp.search.return_value = {"tracks": {"items": [{"id": "track1"}]}}
    mock_sp.user_playlist_create.return_value = {
        "id": "playlist1",
        "external_urls": {"spotify": "https://open.spotify.com/playlist/abc"},
    }

    with patch("playlist_generator.spotipy.Spotify", return_value=mock_sp):
        added, skipped, url = add_songs_with_token(
            "My Playlist",
            [{"song": "Creep", "artist": "Radiohead"}],
            "fake_token",
        )

    assert added == 1
    assert skipped == []
    assert url == "https://open.spotify.com/playlist/abc"
    mock_sp.user_playlist_add_tracks.assert_called_once_with("user123", "playlist1", ["track1"])


def test_skips_unfound_tracks():
    mock_sp = MagicMock()
    mock_sp.current_user.return_value = {"id": "user123"}
    mock_sp.search.side_effect = [
        {"tracks": {"items": [{"id": "t1"}]}},
        {"tracks": {"items": []}},
    ]
    mock_sp.user_playlist_create.return_value = {
        "id": "p1",
        "external_urls": {"spotify": "https://open.spotify.com/playlist/abc"},
    }

    with patch("playlist_generator.spotipy.Spotify", return_value=mock_sp):
        added, skipped, url = add_songs_with_token(
            "My Playlist",
            [{"song": "Creep", "artist": "Radiohead"}, {"song": "Ghost", "artist": "Unknown"}],
            "token",
        )

    assert added == 1
    assert len(skipped) == 1
    assert skipped[0] == "Ghost — Unknown"
    mock_sp.user_playlist_add_tracks.assert_called_once_with("user123", "p1", ["t1"])


def test_raises_when_no_tracks_found():
    mock_sp = MagicMock()
    mock_sp.current_user.return_value = {"id": "user123"}
    mock_sp.search.return_value = {"tracks": {"items": []}}

    with patch("playlist_generator.spotipy.Spotify", return_value=mock_sp):
        with pytest.raises(RuntimeError, match="No tracks"):
            add_songs_with_token(
                "My Playlist",
                [{"song": "Ghost", "artist": "Unknown"}],
                "token",
            )
