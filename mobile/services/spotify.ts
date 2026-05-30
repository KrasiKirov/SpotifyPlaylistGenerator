import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

function requireClientId(): string {
  if (!CLIENT_ID) {
    throw new Error(
      'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID. Set it in eas.json before building.'
    );
  }
  return CLIENT_ID;
}

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'spotifyplaylist',
  native: 'spotifyplaylist://callback',
});
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES = 'playlist-modify-private user-read-private';
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

// The session lives only in memory, for the lifetime of the running app.
// Closing the app (a cold start) wipes it, so the user lands back on the
// pairing screen and must reconnect Spotify — nothing is persisted to disk.
type Session = { accessToken: string; refreshToken: string; expiresAt: number };
let session: Session | null = null;

function base64URLEncode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function connectSpotify(): Promise<void> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = base64URLEncode(randomBytes);

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const stateBytes = await Crypto.getRandomBytesAsync(16);
  const state = base64URLEncode(stateBytes);

  const authUrl =
    `${AUTH_ENDPOINT}?client_id=${requireClientId()}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}` +
    `&state=${state}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Spotify login was cancelled or failed.');
  }

  const urlParams = new URL(result.url);
  const returnedState = urlParams.searchParams.get('state');
  if (returnedState !== state) {
    throw new Error('Spotify login failed: state mismatch.');
  }
  const code = urlParams.searchParams.get('code');
  if (!code) throw new Error('No authorization code returned from Spotify.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: requireClientId(),
    code_verifier: codeVerifier,
  });

  const tokenRes = await timedFetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange Spotify auth code for token.');
  }

  const tokens = await tokenRes.json();
  session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

let pendingRefresh: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    const current = session;
    if (!current) throw new Error('Not connected — please reconnect Spotify.');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: requireClientId(),
    });

    const res = await timedFetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      await disconnect();
      throw new Error('Spotify session expired. Please reconnect.');
    }

    const tokens = await res.json();
    session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? current.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };

    return session.accessToken;
  })();

  try {
    return await pendingRefresh;
  } finally {
    pendingRefresh = null;
  }
}

export async function getAccessToken(): Promise<string> {
  if (session && Date.now() < session.expiresAt - 60_000) {
    return session.accessToken;
  }
  return refreshAccessToken();
}

export async function isConnected(): Promise<boolean> {
  return session !== null;
}

export async function disconnect(): Promise<void> {
  session = null;
}
