from unittest.mock import MagicMock, patch
import pytest
from playlist_generator import add_songs_with_token


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
