import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
if (!CLIENT_ID) {
  throw new Error(
    'EXPO_PUBLIC_SPOTIFY_CLIENT_ID is not set. Add it to mobile/.env before building.'
  );
}

const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'spotifyplaylist' });
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES = 'playlist-modify-private user-read-private';
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

const KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
};

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
    `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}` +
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
    client_id: CLIENT_ID,
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
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  await SecureStore.setItemAsync(KEYS.accessToken, tokens.access_token);
  await SecureStore.setItemAsync(KEYS.refreshToken, tokens.refresh_token);
  await SecureStore.setItemAsync(KEYS.expiresAt, String(expiresAt));
}

let pendingRefresh: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    const refreshToken = await SecureStore.getItemAsync(KEYS.refreshToken);
    if (!refreshToken) throw new Error('No refresh token — please reconnect Spotify.');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
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
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await SecureStore.setItemAsync(KEYS.accessToken, tokens.access_token);
    await SecureStore.setItemAsync(KEYS.expiresAt, String(expiresAt));
    if (tokens.refresh_token) {
      await SecureStore.setItemAsync(KEYS.refreshToken, tokens.refresh_token);
    }

    return tokens.access_token as string;
  })();

  try {
    return await pendingRefresh;
  } finally {
    pendingRefresh = null;
  }
}

export async function getAccessToken(): Promise<string> {
  const expiresAt = Number(await SecureStore.getItemAsync(KEYS.expiresAt) ?? '0');
  const token = await SecureStore.getItemAsync(KEYS.accessToken);
  if (token && Date.now() < expiresAt - 60_000) {
    return token;
  }
  return refreshAccessToken();
}

export async function isConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(KEYS.accessToken);
  return token !== null;
}

export async function disconnect(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.accessToken);
  await SecureStore.deleteItemAsync(KEYS.refreshToken);
  await SecureStore.deleteItemAsync(KEYS.expiresAt);
}
