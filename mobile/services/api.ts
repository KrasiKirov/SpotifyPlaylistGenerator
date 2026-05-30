import { Track } from '../App';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

function requireBackendUrl(): string {
  if (!BACKEND_URL) {
    throw new Error(
      'Missing EXPO_PUBLIC_BACKEND_URL. Set it in eas.json before building.'
    );
  }
  return BACKEND_URL;
}

const REQUEST_TIMEOUT_MS = 30_000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function generatePlaylist(params: {
  prompt: string;
  count: number;
  genre?: string;
  decade?: string;
  mood?: string;
}): Promise<Track[]> {
  const response = await timedFetch(`${requireBackendUrl()}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail ?? 'Failed to generate playlist');
  }
  const data = await response.json();
  return data.tracks as Track[];
}

export async function addToSpotify(params: {
  playlist_name: string;
  tracks: Track[];
  spotify_token: string;
}): Promise<{ added_count: number; skipped: string[]; playlist_url: string }> {
  const response = await timedFetch(`${requireBackendUrl()}/add-to-spotify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail ?? 'Failed to add to Spotify');
  }
  return response.json();
}
