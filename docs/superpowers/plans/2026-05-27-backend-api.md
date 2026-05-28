# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing `playlist_generator.py` in a FastAPI server with two endpoints — `/generate` and `/add-to-spotify` — deployable to Railway or Render.

**Architecture:** `playlist_generator.py` gets a new token-based Spotify function (`add_songs_with_token`) alongside the existing one so the CLI/Streamlit paths are unaffected. `api.py` is a thin FastAPI layer that calls those two functions. A `Dockerfile` packages everything for Railway/Render.

**Tech Stack:** Python 3.11, FastAPI, Uvicorn, Spotipy, OpenAI SDK v1.x, pytest, httpx

---

## File Map

| File | Action | Responsibility |
| ---- | ------ | -------------- |
| `playlist_generator.py` | Modify | Add `add_songs_with_token()` |
| `api.py` | Create | FastAPI app with `/generate` and `/add-to-spotify` |
| `requirements.txt` | Modify | Add fastapi, uvicorn, pytest, httpx |
| `Dockerfile` | Create | Container entrypoint for Railway/Render |
| `tests/test_playlist_generator.py` | Create | Unit tests for `add_songs_with_token` |
| `tests/test_api.py` | Create | Integration tests via FastAPI TestClient |

---

## Task 1: Add `add_songs_with_token()` to `playlist_generator.py`

**Files:**

- Modify: `playlist_generator.py`
- Create: `tests/test_playlist_generator.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/__init__.py` (empty) and `tests/test_playlist_generator.py`:

```python
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
    assert "Ghost" in skipped[0]


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/krasi/Documents/GitHub/SpotifyPlaylistGenerator
pip install pytest httpx
pytest tests/test_playlist_generator.py -v
```

Expected: `ImportError: cannot import name 'add_songs_with_token'`

- [ ] **Step 3: Add `add_songs_with_token()` to `playlist_generator.py`**

Append to the bottom of `playlist_generator.py` (after the existing `add_songs_to_spotify` function):

```python
def add_songs_with_token(
    playlist_name: str,
    playlist: list[dict],
    access_token: str,
) -> tuple[int, list[str], str]:
    sp = spotipy.Spotify(auth=access_token)

    current_user = sp.current_user()
    if current_user is None:
        raise RuntimeError("Spotify authentication failed — invalid token.")

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

    created = sp.user_playlist_create(current_user["id"], name=playlist_name, public=False)
    sp.user_playlist_add_tracks(current_user["id"], created["id"], track_ids)
    playlist_url = created["external_urls"]["spotify"]

    return len(track_ids), skipped, playlist_url
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_playlist_generator.py -v
```

Expected: 3 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add playlist_generator.py tests/__init__.py tests/test_playlist_generator.py
git commit -m "feat: add add_songs_with_token() for token-based Spotify auth"
```

---

## Task 2: Create `api.py` with `/generate` endpoint

**Files:**

- Create: `api.py`
- Create: `tests/test_api.py`

- [ ] **Step 1: Write failing tests for `/generate`**

Create `tests/test_api.py`:

```python
from fastapi.testclient import TestClient
from unittest.mock import patch
import pytest


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api.py::test_generate_returns_tracks tests/test_api.py::test_generate_rejects_count_zero -v
```

Expected: `ModuleNotFoundError: No module named 'api'`

- [ ] **Step 3: Create `api.py` with the `/generate` endpoint**

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from playlist_generator import get_playlist, add_songs_with_token
import spotipy

app = FastAPI(title="Spotify Playlist Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str
    count: int = Field(default=8, ge=1, le=50)
    genre: str = ""
    decade: str = ""
    mood: str = ""


class Track(BaseModel):
    song: str
    artist: str


class GenerateResponse(BaseModel):
    tracks: list[Track]


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    prompt_parts = [req.prompt]
    if req.genre:
        prompt_parts.append(f"genre: {req.genre}")
    if req.decade:
        prompt_parts.append(f"decade: {req.decade}")
    if req.mood:
        prompt_parts.append(f"mood: {req.mood}")
    full_prompt = ", ".join(prompt_parts)

    try:
        playlist = get_playlist(full_prompt, req.count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return GenerateResponse(tracks=[Track(**t) for t in playlist])
```

- [ ] **Step 4: Run the generate tests**

```bash
pytest tests/test_api.py::test_generate_returns_tracks tests/test_api.py::test_generate_rejects_count_zero tests/test_api.py::test_generate_rejects_count_over_50 tests/test_api.py::test_generate_builds_full_prompt -v
```

Expected: 4 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add api.py tests/test_api.py
git commit -m "feat: add FastAPI /generate endpoint"
```

---

## Task 3: Add `/add-to-spotify` endpoint

**Files:**

- Modify: `api.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Add failing tests for `/add-to-spotify`**

Append to `tests/test_api.py`:

```python
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
```

Add `import spotipy` to the top of `tests/test_api.py`.

- [ ] **Step 2: Run new tests to verify they fail**

```bash
pytest tests/test_api.py::test_add_to_spotify_success -v
```

Expected: `404 Not Found` (endpoint doesn't exist yet)

- [ ] **Step 3: Add the `/add-to-spotify` endpoint to `api.py`**

Add after the `GenerateResponse` class definition:

```python
class AddToSpotifyRequest(BaseModel):
    playlist_name: str
    tracks: list[Track]
    spotify_token: str


class AddToSpotifyResponse(BaseModel):
    added_count: int
    skipped: list[str]
    playlist_url: str
```

Add after the `/generate` route:

```python
@app.post("/add-to-spotify", response_model=AddToSpotifyResponse)
def add_to_spotify(req: AddToSpotifyRequest):
    try:
        added, skipped, url = add_songs_with_token(
            req.playlist_name,
            [t.model_dump() for t in req.tracks],
            req.spotify_token,
        )
    except spotipy.SpotifyException as e:
        if e.http_status == 401:
            raise HTTPException(status_code=401, detail="Spotify token is invalid or expired.")
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return AddToSpotifyResponse(added_count=added, skipped=skipped, playlist_url=url)
```

- [ ] **Step 4: Run all API tests**

```bash
pytest tests/test_api.py -v
```

Expected: 7 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add api.py tests/test_api.py
git commit -m "feat: add FastAPI /add-to-spotify endpoint"
```

---

## Task 4: Add `Dockerfile` and update `requirements.txt`

**Files:**

- Modify: `requirements.txt`
- Create: `Dockerfile`

- [ ] **Step 1: Update `requirements.txt`**

Replace the contents of `requirements.txt` with:

```
openai>=1.0.0
spotipy>=2.23.0
python-dotenv>=1.0.0
streamlit>=1.28.0
fastapi>=0.104.0
uvicorn>=0.24.0
pytest>=7.0.0
httpx>=0.25.0
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

```bash
pip install -r requirements.txt
pytest tests/ -v
```

Expected: all tests PASSED

- [ ] **Step 4: Commit**

```bash
git add requirements.txt Dockerfile
git commit -m "chore: add Dockerfile and dev dependencies for API deployment"
```

---

## Task 5: Deploy to Railway and smoke test

**Files:** No code changes — deployment and manual verification only.

- [ ] **Step 1: Create a Railway project**

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project → Deploy from GitHub repo**
3. Select the `SpotifyPlaylistGenerator` repo
4. Railway auto-detects the `Dockerfile` and starts the build

- [ ] **Step 2: Set the environment variable**

In the Railway dashboard, go to your service → **Variables** → add:

```
OPENAI_API_KEY=<your key>
```

- [ ] **Step 3: Get the deployed URL**

In Railway dashboard → **Settings → Networking → Generate Domain**. Copy the URL (e.g. `https://spotifyplaylist-production.up.railway.app`).

- [ ] **Step 4: Smoke test `/generate`**

```bash
curl -s -X POST https://<your-railway-url>/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "chill evening jazz", "count": 3}' | python3 -m json.tool
```

Expected response shape:

```json
{
  "tracks": [
    {"song": "So What", "artist": "Miles Davis"},
    {"song": "Take Five", "artist": "Dave Brubeck"},
    {"song": "Autumn Leaves", "artist": "Cannonball Adderley"}
  ]
}
```

- [ ] **Step 5: Note the deployed URL**

You will need it for the mobile app plan as `EXPO_PUBLIC_BACKEND_URL`.
