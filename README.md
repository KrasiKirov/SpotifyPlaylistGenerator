# The Listening Room

> A pocket librarian for the records you haven't yet met. Describe a mood; receive a tracklist; press it to Spotify.

---

## Try it now

**Android** — [Download the latest APK](https://github.com/KrasiKirov/SpotifyPlaylistGenerator/releases/latest), open it on your phone, and open the app. The backend is hosted and ready, no setup required.

## Screenshots

> _Add four captures to [`docs/screenshots/`](docs/screenshots/) with the filenames below and they'll render here. See that folder's README for how to capture them._

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/connect.png" alt="Connect screen" width="200"></td>
    <td align="center"><img src="docs/screenshots/home.png" alt="Home screen" width="200"></td>
    <td align="center"><img src="docs/screenshots/preview.png" alt="Preview screen" width="200"></td>
    <td align="center"><img src="docs/screenshots/result.png" alt="Result screen" width="200"></td>
  </tr>
  <tr>
    <td align="center">Pair with Spotify (PKCE)</td>
    <td align="center">Describe the evening</td>
    <td align="center">Curate the tracklist</td>
    <td align="center">The side is set</td>
  </tr>
</table>

## What it does

You describe an evening; *"late drive home through the rain after a long film"* , choose a length, add optional filters (genre, decade, mood), and the app:

1. Asks OpenAI to compose a tracklist.
2. Looks up each track on Spotify.
3. Saves it as a private playlist on your account.
4. Opens it in Spotify on tap.

Tracks can be struck from the preview before saving, and the playlist name can be edited.

## How it works

```text
     ┌────────────────────┐         ┌─────────────────────────┐
     │  Spotify accounts  │ ◄────── │  Mobile app (APK)       │
     │   PKCE auth flow   │ ──────► │  React Native · Expo    │
     └────────────────────┘         │  expo-secure-store      │
                                    └────┬────────────────────┘
                                         │  POST /generate
                                         │  POST /add-to-spotify
                                         ▼
                              ┌──────────────────────────┐
                              │  FastAPI · Railway       │
                              │  rate-limited, validated │
                              └────┬──────────────┬──────┘
                                   │              │
                                   ▼              ▼
                            ┌──────────────┐  ┌──────────────┐
                            │ OpenAI       │  │ Spotify      │
                            │ gpt-4.1-mini │  │ Web API      │
                            └──────────────┘  └──────────────┘
```

The mobile client holds the Spotify access token in `expo-secure-store` and forwards it on every `/add-to-spotify` request. The server never persists user tokens or OpenAI responses.

## Repo layout

| Path                                                       | What it is                                  |
| ---------------------------------------------------------- | ------------------------------------------- |
| [`api.py`](api.py)                                         | FastAPI app: `/generate`, `/add-to-spotify` |
| [`playlist_generator.py`](playlist_generator.py)           | OpenAI prompting + Spotify track resolution |
| [`app.py`](app.py)                                         | Optional CLI for local use                  |
| [`Dockerfile`](Dockerfile)                                 | Container for Railway / Render / Fly        |
| [`mobile/`](mobile/)                                       | Expo (SDK 54) React Native app              |
| [`mobile/services/spotify.ts`](mobile/services/spotify.ts) | PKCE OAuth, token refresh, secure storage   |
| [`mobile/services/api.ts`](mobile/services/api.ts)         | Backend HTTP client with timeouts           |
| [`mobile/screens/`](mobile/screens/)                       | Home, Preview, Result                       |
| [`tests/`](tests/)                                         | Pytest suite (22 tests)                     |

## Run locally

### Backend

```bash
cp .env.example .env
# fill in OPENAI_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
pip install -r requirements.txt
uvicorn api:app --reload
```

### Mobile

```bash
cd mobile
cp .env.example .env
# set EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000  (Android emulator → host)
# set EXPO_PUBLIC_SPOTIFY_CLIENT_ID=<your_client_id>
npm install
npx expo start
```

Open Expo Go on your device, scan the QR code. For PKCE auth to return cleanly, register `spotifyplaylist://callback` as a Redirect URI in the [Spotify developer dashboard](https://developer.spotify.com/dashboard).

### CLI (optional)

```bash
python app.py -p "rainy day indie folk" -n 12 --yes
```

| Flag             | Meaning                         |
| ---------------- | ------------------------------- |
| `-p`             | The prompt                      |
| `-n`             | Number of tracks (1–50)         |
| `-g`, `-d`, `-m` | Genre, decade, mood (optional)  |
| `--yes`          | Skip the confirmation prompt    |

The CLI uses local `SpotifyOAuth` with a `localhost:9999` callback — useful for testing the generator without the mobile app.

## Tech stack

- **Mobile** — React Native, Expo SDK 54, expo-auth-session, expo-secure-store, expo-linear-gradient
- **Backend** — FastAPI, Pydantic v2, SlowAPI, Spotipy
- **AI** — OpenAI `gpt-4.1-mini`, JSON-mode structured output
- **Infra** — Railway (backend), EAS Build (Android)

## Security notes

- The mobile app uses PKCE, so no secret is needed.
- Spotify access tokens are stored on-device with `expo-secure-store` and forwarded to the backend per request; the server holds them only for the duration of a single call.
- The `/generate` and `/add-to-spotify` endpoints are rate-limited (10/hour per IP) and input-capped. Request bodies are capped at 64 KiB.
