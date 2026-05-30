# The Listening Room

> A pocket librarian for the records you haven't yet met. Describe a mood; receive a tracklist; press it to Spotify.

---

## Try it now

**Android** — [Download the latest APK](https://github.com/KrasiKirov/SpotifyPlaylistGenerator/releases/latest), open it on your phone, and open the app. The backend is hosted and ready — no setup required.

**iOS** — not yet built. The API is open at [`/docs`](https://spotifyplaylistgenerator-production.up.railway.app/docs) if you'd like to hit it directly.

## What it does

You describe an evening — *"late drive home through the rain after a long film"* — choose a length, add optional filters (genre, decade, mood), and the app:

1. Asks OpenAI to compose a tracklist.
2. Looks up each track on Spotify.
3. Saves it as a private playlist on your account.
4. Opens it in Spotify on tap.

Tracks can be struck from the preview before saving, and the playlist name is editable.

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

Visit `http://localhost:8000/docs` for the auto-generated OpenAPI playground.

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

## Deploying the backend

The container is stateless. Required environment variables on your host:

| Var                   | Purpose                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`      | Your OpenAI key.                                                                                              |
| `TRUST_PROXY_HEADERS` | Set to `1` behind a proxy (Railway, Fly, Cloudflare) so rate limits key on the real client IP, not the proxy. |
| `ALLOWED_ORIGINS`     | Comma-separated, only needed if a browser will call the API. Native mobile clients don't need CORS.           |
| `PORT`                | Provided automatically on Railway / Render.                                                                   |

```bash
docker build -t listening-room .
docker run -p 8000:8000 -e OPENAI_API_KEY=sk-... listening-room
```

## Building the APK

Mobile env values bake in at build time. Set them in [`mobile/eas.json`](mobile/eas.json):

```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://your-backend.example.com",
  "EXPO_PUBLIC_SPOTIFY_CLIENT_ID": "your_client_id"
}
```

Then:

```bash
cd mobile
npx eas build --profile preview --platform android
```

EAS returns a download URL when the build finishes (~10–15 min). For a public release, upload the resulting `.apk` to GitHub Releases so the [download link](https://github.com/KrasiKirov/SpotifyPlaylistGenerator/releases/latest) above works:

```bash
gh release create v1.0.0 path/to/app.apk \
  --title "v1.0.0" \
  --notes "Initial public APK"
```

## Tech stack

- **Mobile** — React Native, Expo SDK 54, expo-auth-session, expo-secure-store, expo-linear-gradient
- **Type** — Fraunces (variable serif), IBM Plex Mono
- **Backend** — FastAPI, Pydantic v2, SlowAPI, Spotipy
- **AI** — OpenAI `gpt-4.1-mini`, JSON-mode structured output
- **Infra** — Railway (backend), EAS Build (Android)

## Security notes

- The Spotify client secret lives only in the backend `.env` (or Railway's environment), used solely by the optional CLI. The mobile app uses PKCE — no secret needed.
- Spotify access tokens are stored on-device with `expo-secure-store` and forwarded to the backend per request; the server holds them only for the duration of a single call.
- The `/generate` and `/add-to-spotify` endpoints are rate-limited (10/hour per IP) and input-capped. Request bodies are capped at 64 KiB.

## License

MIT
