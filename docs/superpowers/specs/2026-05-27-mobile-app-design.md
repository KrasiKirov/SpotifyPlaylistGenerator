# Spotify Playlist Generator — Mobile App Design

**Date:** 2026-05-27
**Status:** Approved

---

## Goal

Add a FastAPI backend and a React Native (Expo) mobile app so users can generate and save Spotify playlists from their phone, without the CLI or Streamlit UI.

---

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│                  Expo Mobile App                     │
│  HomeScreen → PreviewScreen → ResultScreen          │
│  expo-auth-session (Spotify PKCE OAuth)             │
└──────────────┬──────────────────┬───────────────────┘
               │ POST /generate   │ POST /add-to-spotify
               │                  │ (+ Spotify token)
        ┌──────▼──────────────────▼──────┐
        │     FastAPI (Railway/Render)    │
        │  api.py — two endpoints         │
        │  playlist_generator.py (existing│
        └────────┬────────────────────────┘
                 │
        ┌────────▼────────┐     ┌──────────────┐
        │   OpenAI API    │     │  Spotify API  │
        │  (key stays     │     │  (user token  │
        │   server-side)  │     │   from mobile)│
        └─────────────────┘     └──────────────┘
```

**Key decisions:**

- Backend holds only `OPENAI_API_KEY` — no Spotify credentials needed server-side
- Mobile app handles Spotify PKCE OAuth; access token is passed in each `/add-to-spotify` request
- Spotify token stored on-device in `expo-secure-store` (encrypted)
- `playlist_generator.py` is largely unchanged — `api.py` wraps its functions as HTTP endpoints

---

## Backend

### New / Changed Files

| File                     | Action | Purpose                                               |
| ------------------------ | ------ | ----------------------------------------------------- |
| `api.py`                 | Create | FastAPI app; exposes `/generate` and `/add-to-spotify` |
| `playlist_generator.py`  | Modify | Add `add_songs_with_token()` variant for token-based auth |
| `requirements.txt`       | Modify | Add `fastapi`, `uvicorn`                              |
| `Dockerfile`             | Create | Container for Railway/Render deployment               |

### Endpoints

```text
POST /generate
Body:    { prompt: str, count: int, genre?: str, decade?: str, mood?: str }
Returns: { tracks: [{song: str, artist: str}] }
Errors:  422 if count < 1 or > 50; 500 if OpenAI call fails

POST /add-to-spotify
Body:    { playlist_name: str, tracks: [{song, artist}], spotify_token: str }
Returns: { added_count: int, skipped: [str], playlist_url: str }
Errors:  401 if Spotify token is invalid; 500 if no tracks found
```

### `playlist_generator.py` Change

Add a second Spotify function alongside the existing one (existing function unchanged so CLI/Streamlit still work):

```python
def add_songs_with_token(
    playlist_name: str,
    playlist: list[dict],
    access_token: str,
) -> tuple[int, list[str], str]:
    # Returns (added_count, skipped, playlist_url)
    sp = spotipy.Spotify(auth=access_token)
    # same search + create + add logic as add_songs_to_spotify()
    # additionally returns created["external_urls"]["spotify"]
```

### Deployment

- `Dockerfile` runs `uvicorn api:app --host 0.0.0.0 --port $PORT`
- Environment variable required on Railway/Render: `OPENAI_API_KEY`
- CORS configured to allow requests from any origin (mobile app has no fixed domain)

---

## Mobile App

### Tech Stack

- Expo (React Native) with TypeScript
- `expo-auth-session` — Spotify PKCE OAuth
- `expo-secure-store` — encrypted token storage
- `expo-linking` — deep link back to app after OAuth
- React Navigation (stack navigator)
- React Native's built-in `StyleSheet` for styling

### File Layout

```text
mobile/
  App.tsx                   # navigation stack + Spotify auth init
  screens/
    HomeScreen.tsx          # prompt form + Spotify connect
    PreviewScreen.tsx       # generated song list + Add to Spotify
    ResultScreen.tsx        # success, skipped songs, open in Spotify
  services/
    api.ts                  # fetch calls to FastAPI backend
    spotify.ts              # PKCE OAuth, token save/load/refresh
```

### Screen Flow

```text
Home ──[Generate]──► Preview ──[Add to Spotify]──► Result
                        │
                  [Regenerate]──► Home
```

**HomeScreen:**

- On first launch: "Connect Spotify" button — triggers PKCE flow in device browser
- After connect: prompt text input, optional genre/decade/mood text inputs, song count slider (1–50), "Generate" button
- "Generate" calls `POST /generate` and navigates to PreviewScreen with the track list

**PreviewScreen:**

- Numbered list of `{song} — {artist}`
- "Add to Spotify" button — calls `POST /add-to-spotify` with the stored token, navigates to ResultScreen
- "Regenerate" button — goes back to HomeScreen

**ResultScreen:**

- Success message with song count and skipped count
- Expandable list of skipped songs (if any)
- "Open in Spotify" button — deep links to `playlist_url`
- "Make Another" button — resets to HomeScreen

### Spotify OAuth (PKCE)

The mobile app needs `SPOTIFY_CLIENT_ID` (public, safe to ship in the app) but NOT `SPOTIFY_CLIENT_SECRET` — that is never used in the PKCE flow. Set it as `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` in `mobile/.env`.

1. `expo-auth-session` initiates authorization against `https://accounts.spotify.com/authorize` with scopes `playlist-modify-private user-read-private`
2. User logs in via device browser, Spotify redirects back to the app via a custom URI scheme (`spotifyplaylist://`)
3. App exchanges the auth code for `access_token` + `refresh_token` via `https://accounts.spotify.com/api/token`
4. Both tokens saved to `expo-secure-store`
5. Before each API call, app checks token expiry and refreshes silently if needed

### `services/api.ts` Interface

```typescript
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export async function generatePlaylist(params: {
  prompt: string;
  count: number;
  genre?: string;
  decade?: string;
  mood?: string;
}): Promise<Array<{ song: string; artist: string }>>

export async function addToSpotify(params: {
  playlist_name: string;
  tracks: Array<{ song: string; artist: string }>;
  spotify_token: string;
}): Promise<{ added_count: number; skipped: string[]; playlist_url: string }>
```

### `services/spotify.ts` Interface

```typescript
export async function connectSpotify(): Promise<void>    // triggers PKCE flow
export async function getAccessToken(): Promise<string>  // returns valid token, refreshing if needed
export async function isConnected(): Promise<boolean>    // checks stored token exists
export async function disconnect(): Promise<void>        // clears stored tokens
```

---

## Error Handling

| Scenario                           | Behavior                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| OpenAI call fails                  | Backend returns 500; mobile shows error toast, stays on HomeScreen    |
| Spotify token expired              | `getAccessToken()` refreshes silently before the call                 |
| Spotify token invalid/refresh fails | `spotify.ts` clears token; HomeScreen shows "Reconnect Spotify"      |
| No tracks found on Spotify         | Backend returns 500 with message; mobile shows error toast            |
| Some tracks not found              | Backend returns normally with `skipped` list; ResultScreen shows them |
| Network offline                    | `fetch` throws; mobile catches and shows "Check your connection" toast |

---

## Out of Scope

- User accounts or server-side session storage
- Playlist history / saved playlists
- Editing the generated list before adding
- Android / iOS app store submission (development build only for now)
