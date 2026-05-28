import { Track } from '../App';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

export async function generatePlaylist(params: {
  prompt: string;
  count: number;
  genre?: string;
  decade?: string;
  mood?: string;
}): Promise<Track[]> {
  const response = await fetch(`${BACKEND_URL}/generate`, {
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
  const response = await fetch(`${BACKEND_URL}/add-to-spotify`, {
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
