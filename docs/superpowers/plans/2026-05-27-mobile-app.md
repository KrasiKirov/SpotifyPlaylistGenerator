# Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) mobile app with three screens — Home, Preview, Result — that calls the FastAPI backend to generate and save Spotify playlists.

**Architecture:** `services/api.ts` handles all HTTP calls to the FastAPI backend. `services/spotify.ts` handles PKCE OAuth, token storage, and refresh. Three screens form a linear stack: Home (input) → Preview (confirm) → Result (success). Navigation types are defined in `App.tsx` and shared across screens.

**Tech Stack:** Expo SDK 51, TypeScript, React Navigation v6, expo-auth-session, expo-secure-store, expo-web-browser, expo-crypto, @react-native-community/slider

**Prerequisite:** The FastAPI backend from `docs/superpowers/plans/2026-05-27-backend-api.md` must be deployed and its URL must be known before starting Task 6.

---

## File Map

| File | Action | Responsibility |
| ---- | ------ | -------------- |
| `mobile/App.tsx` | Create | Navigation stack + shared type definitions |
| `mobile/services/api.ts` | Create | HTTP calls to FastAPI backend |
| `mobile/services/spotify.ts` | Create | Spotify PKCE OAuth, token save/load/refresh |
| `mobile/screens/HomeScreen.tsx` | Create | Prompt form and Spotify connect button |
| `mobile/screens/PreviewScreen.tsx` | Create | Song list with Add to Spotify action |
| `mobile/screens/ResultScreen.tsx` | Create | Success message and deep link to Spotify |
| `mobile/app.json` | Modify | Add `scheme: "spotifyplaylist"` |
| `mobile/.env` | Create | `EXPO_PUBLIC_BACKEND_URL` and `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` |

---

## Task 1: Initialize Expo project and install dependencies

**Files:**

- Create: `mobile/` directory via Expo CLI

- [ ] **Step 1: Create the Expo project**

```bash
cd /Users/krasi/Documents/GitHub/SpotifyPlaylistGenerator
npx create-expo-app mobile --template blank-typescript
```

- [ ] **Step 2: Install all dependencies**

```bash
cd mobile
npx expo install \
  @react-navigation/native \
  @react-navigation/native-stack \
  expo-auth-session \
  expo-secure-store \
  expo-web-browser \
  expo-crypto \
  expo-linking \
  react-native-screens \
  react-native-safe-area-context \
  @react-native-community/slider
```

- [ ] **Step 3: Add `scheme` to `mobile/app.json`**

Open `mobile/app.json`. Find the `"expo"` object and add `"scheme": "spotifyplaylist"`:

```json
{
  "expo": {
    "name": "Spotify Playlist Generator",
    "slug": "spotify-playlist-generator",
    "scheme": "spotifyplaylist",
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "supportsTablet": false
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1DB954"
      }
    }
  }
}
```

- [ ] **Step 4: Create `mobile/.env`**

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

(Replace `EXPO_PUBLIC_BACKEND_URL` with the Railway URL once deployed. `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` is found in your Spotify Developer Dashboard.)

- [ ] **Step 5: Add Spotify redirect URIs to your Spotify Developer Dashboard**

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Select your app → **Edit Settings**
3. Under **Redirect URIs** add both:
   - `spotifyplaylist://` (production)
   - `exp://127.0.0.1:8081` (Expo Go development — your local IP may differ, check terminal output when starting Expo)
4. Click **Save**

- [ ] **Step 6: Verify Expo starts without errors**

```bash
cd mobile
npx expo start
```

Expected: QR code shown, no red errors in terminal.

- [ ] **Step 7: Commit**

```bash
cd ..
git add mobile/
git commit -m "chore: initialize Expo project with dependencies"
```

---

## Task 2: Set up navigation in `App.tsx`

**Files:**

- Modify: `mobile/App.tsx`

- [ ] **Step 1: Replace `mobile/App.tsx` with navigation setup**

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import PreviewScreen from './screens/PreviewScreen';
import ResultScreen from './screens/ResultScreen';

export type Track = { song: string; artist: string };

export type RootStackParamList = {
  Home: undefined;
  Preview: { tracks: Track[]; playlistName: string };
  Result: { addedCount: number; skipped: string[]; playlistUrl: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerStyle: { backgroundColor: '#1DB954' }, headerTintColor: '#fff' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Playlist Generator' }} />
        <Stack.Screen name="Preview" component={PreviewScreen} options={{ title: 'Preview Songs' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Done!' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Create stub screens so the app compiles**

Create `mobile/screens/HomeScreen.tsx`:

```tsx
import { View, Text } from 'react-native';
export default function HomeScreen() {
  return <View><Text>Home</Text></View>;
}
```

Create `mobile/screens/PreviewScreen.tsx`:

```tsx
import { View, Text } from 'react-native';
export default function PreviewScreen() {
  return <View><Text>Preview</Text></View>;
}
```

Create `mobile/screens/ResultScreen.tsx`:

```tsx
import { View, Text } from 'react-native';
export default function ResultScreen() {
  return <View><Text>Result</Text></View>;
}
```

- [ ] **Step 3: Verify app loads with navigation bar visible**

```bash
cd mobile && npx expo start
```

Open on device/simulator. Expected: green header bar with "Playlist Generator" title, white "Home" text in the body.

- [ ] **Step 4: Commit**

```bash
cd ..
git add mobile/App.tsx mobile/screens/
git commit -m "feat: set up React Navigation stack with stub screens"
```

---

## Task 3: Build `services/api.ts`

**Files:**

- Create: `mobile/services/api.ts`

- [ ] **Step 1: Create `mobile/services/api.ts`**

```typescript
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
```

- [ ] **Step 2: Smoke test against the local backend**

Start the backend in one terminal:

```bash
cd /Users/krasi/Documents/GitHub/SpotifyPlaylistGenerator
uvicorn api:app --reload
```

In a second terminal, verify the backend is reachable:

```bash
curl -s -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"happy songs","count":2}' | python3 -m json.tool
```

Expected: JSON with a `tracks` array.

- [ ] **Step 3: Commit**

```bash
git add mobile/services/api.ts
git commit -m "feat: add api.ts service for backend HTTP calls"
```

---

## Task 4: Build `services/spotify.ts`

**Files:**

- Create: `mobile/services/spotify.ts`

- [ ] **Step 1: Create `mobile/services/spotify.ts`**

```typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'spotifyplaylist' });
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SCOPES = 'playlist-modify-private user-read-private';

const KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  codeVerifier: 'spotify_code_verifier',
};

function base64URLEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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

  await SecureStore.setItemAsync(KEYS.codeVerifier, codeVerifier);

  const authUrl =
    `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge_method=S256` +
    `&code_challenge=${codeChallenge}`;

  const result = await AuthSession.startAsync({ authUrl });

  if (result.type !== 'success' || !result.params?.code) {
    throw new Error('Spotify login was cancelled or failed.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: result.params.code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
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

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(KEYS.refreshToken);
  if (!refreshToken) throw new Error('No refresh token — please reconnect Spotify.');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
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

  return tokens.access_token;
}

export async function getAccessToken(): Promise<string> {
  const expiresAt = Number(await SecureStore.getItemAsync(KEYS.expiresAt) ?? '0');
  if (Date.now() < expiresAt - 60_000) {
    return (await SecureStore.getItemAsync(KEYS.accessToken))!;
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
  await SecureStore.deleteItemAsync(KEYS.codeVerifier);
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/services/spotify.ts
git commit -m "feat: add spotify.ts PKCE OAuth service"
```

---

## Task 5: Build `HomeScreen.tsx`

**Files:**

- Modify: `mobile/screens/HomeScreen.tsx`

- [ ] **Step 1: Replace `HomeScreen.tsx` with the full implementation**

```tsx
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { generatePlaylist } from '../services/api';
import { connectSpotify, isConnected } from '../services/spotify';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [connected, setConnected] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('');
  const [decade, setDecade] = useState('');
  const [mood, setMood] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isConnected().then(setConnected);
  }, []);

  async function handleConnect() {
    try {
      await connectSpotify();
      setConnected(true);
    } catch (e: any) {
      Alert.alert('Connection failed', e.message);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      Alert.alert('Missing prompt', 'Please describe your playlist.');
      return;
    }
    setLoading(true);
    try {
      const tracks = await generatePlaylist({ prompt, count, genre, decade, mood });
      navigation.navigate('Preview', { tracks, playlistName: prompt });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Spotify Playlist Generator</Text>
        <Text style={styles.subtitle}>Connect your Spotify account to get started.</Text>
        <TouchableOpacity style={styles.button} onPress={handleConnect}>
          <Text style={styles.buttonText}>Connect Spotify</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        placeholder="Describe your playlist (e.g. rainy day indie folk)"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        returnKeyType="done"
      />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex1]} placeholder="Genre" value={genre} onChangeText={setGenre} />
        <TextInput style={[styles.input, styles.flex1]} placeholder="Decade" value={decade} onChangeText={setDecade} />
        <TextInput style={[styles.input, styles.flex1]} placeholder="Mood" value={mood} onChangeText={setMood} />
      </View>
      <Text style={styles.label}>Songs: {count}</Text>
      <Slider
        minimumValue={1}
        maximumValue={50}
        step={1}
        value={count}
        onValueChange={(v) => setCount(Math.round(v))}
        minimumTrackTintColor="#1DB954"
      />
      <TouchableOpacity
        style={[styles.button, loading && styles.disabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Generate</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  label: { fontSize: 16, fontWeight: '500', color: '#333' },
  button: {
    backgroundColor: '#1DB954', padding: 16,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Test on device/simulator**

In Expo Go: tap "Connect Spotify" — device browser should open Spotify login page. After login, the form should appear. Enter "happy songs" and tap Generate. Expected: navigate to Preview screen (shows "Preview" stub for now).

- [ ] **Step 3: Commit**

```bash
git add mobile/screens/HomeScreen.tsx
git commit -m "feat: build HomeScreen with Spotify connect and playlist prompt form"
```

---

## Task 6: Build `PreviewScreen.tsx`

**Files:**

- Modify: `mobile/screens/PreviewScreen.tsx`

- [ ] **Step 1: Replace `PreviewScreen.tsx` with the full implementation**

```tsx
import { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { addToSpotify } from '../services/api';
import { getAccessToken, disconnect } from '../services/spotify';

type Props = NativeStackScreenProps<RootStackParamList, 'Preview'>;

export default function PreviewScreen({ route, navigation }: Props) {
  const { tracks, playlistName } = route.params;
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const result = await addToSpotify({
        playlist_name: playlistName,
        tracks,
        spotify_token: token,
      });
      navigation.replace('Result', {
        addedCount: result.added_count,
        skipped: result.skipped,
        playlistUrl: result.playlist_url,
      });
    } catch (e: any) {
      if (e.message.includes('expired') || e.message.includes('reconnect')) {
        await disconnect();
        Alert.alert('Session expired', 'Please reconnect Spotify.', [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.track}>
            <Text style={styles.number}>{index + 1}.</Text>
            <View style={styles.trackInfo}>
              <Text style={styles.song}>{item.song}</Text>
              <Text style={styles.artist}>{item.artist}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, loading && styles.disabled]}
          onPress={handleAdd}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Add to Spotify</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  list: { padding: 16 },
  track: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    gap: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  number: { fontSize: 14, color: '#aaa', width: 28, textAlign: 'right' },
  trackInfo: { flex: 1 },
  song: { fontSize: 16, fontWeight: '500', color: '#111' },
  artist: { fontSize: 14, color: '#666', marginTop: 2 },
  footer: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  button: {
    flex: 1, backgroundColor: '#1DB954',
    padding: 16, borderRadius: 8, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    flex: 1, backgroundColor: '#eee',
    padding: 16, borderRadius: 8, alignItems: 'center',
  },
  secondaryText: { fontSize: 16, fontWeight: '600', color: '#333' },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Test on device/simulator**

Generate a playlist from HomeScreen. On PreviewScreen, verify:

- Songs are listed with numbers
- "Regenerate" goes back to HomeScreen
- "Add to Spotify" calls the backend and navigates to Result (stub for now)

- [ ] **Step 3: Commit**

```bash
git add mobile/screens/PreviewScreen.tsx
git commit -m "feat: build PreviewScreen with song list and Add to Spotify action"
```

---

## Task 7: Build `ResultScreen.tsx`

**Files:**

- Modify: `mobile/screens/ResultScreen.tsx`

- [ ] **Step 1: Replace `ResultScreen.tsx` with the full implementation**

```tsx
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { addedCount, skipped, playlistUrl } = route.params;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.title}>Playlist created!</Text>
      <Text style={styles.subtitle}>{addedCount} songs added to Spotify.</Text>

      {skipped.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowSkipped(!showSkipped)}>
            <Text style={styles.skippedToggle}>
              {skipped.length} song{skipped.length > 1 ? 's' : ''} not found on Spotify {showSkipped ? '▴' : '▾'}
            </Text>
          </TouchableOpacity>
          {showSkipped && (
            <FlatList
              data={skipped}
              keyExtractor={(_, i) => String(i)}
              style={styles.skippedList}
              renderItem={({ item }) => <Text style={styles.skippedItem}>• {item}</Text>}
            />
          )}
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(playlistUrl)}>
        <Text style={styles.buttonText}>Open in Spotify</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.popToTop()}>
        <Text style={styles.secondaryText}>Make Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, padding: 24, alignItems: 'center',
    justifyContent: 'center', gap: 16, backgroundColor: '#fff',
  },
  checkmark: { fontSize: 72, color: '#1DB954' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 18, color: '#444' },
  skippedToggle: { color: '#999', fontSize: 14, textDecorationLine: 'underline' },
  skippedList: { maxHeight: 140, width: '100%' },
  skippedItem: { fontSize: 14, color: '#777', paddingVertical: 2 },
  button: {
    backgroundColor: '#1DB954', padding: 16,
    borderRadius: 8, alignItems: 'center', width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    backgroundColor: '#eee', padding: 16,
    borderRadius: 8, alignItems: 'center', width: '100%',
  },
  secondaryText: { fontSize: 16, fontWeight: '600', color: '#333' },
});
```

- [ ] **Step 2: Full end-to-end test on device**

Run the complete flow:

1. Open app → tap "Connect Spotify" → log in
2. Enter "upbeat 90s hip-hop" → tap Generate
3. Verify song list appears on PreviewScreen
4. Tap "Add to Spotify" → verify ResultScreen shows count and green checkmark
5. Tap "Open in Spotify" → Spotify app should open to the new playlist
6. Tap "Make Another" → back to HomeScreen

- [ ] **Step 3: Update `EXPO_PUBLIC_BACKEND_URL` in `mobile/.env` to the Railway URL**

```
EXPO_PUBLIC_BACKEND_URL=https://<your-app>.up.railway.app
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=<your_client_id>
```

- [ ] **Step 4: Commit**

```bash
git add mobile/screens/ResultScreen.tsx mobile/.env
git commit -m "feat: build ResultScreen with success state and Spotify deep link"
```

---

## Self-Review

**Spec coverage:**

- [x] HomeScreen with Spotify connect → Task 5
- [x] PreviewScreen with song list and Add to Spotify → Task 6
- [x] ResultScreen with success, skipped, deep link → Task 7
- [x] `services/api.ts` with `generatePlaylist` and `addToSpotify` → Task 3
- [x] `services/spotify.ts` with PKCE OAuth, token storage, refresh → Task 4
- [x] Navigation stack with typed params → Task 2
- [x] `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` in `.env` → Task 1 step 4
- [x] Spotify redirect URI setup → Task 1 step 5
- [x] `scheme: "spotifyplaylist"` in `app.json` → Task 1 step 3
- [x] Expired token → disconnect + prompt reconnect → Task 6 `handleAdd`
- [x] Network error → Alert with message → Task 5 `handleGenerate`, Task 6 `handleAdd`
- [x] `EXPO_PUBLIC_BACKEND_URL` env var → Task 3, Task 7 step 3

**Type consistency check:**

- `Track` defined in `App.tsx` as `{ song: string; artist: string }` — used consistently in `api.ts`, `HomeScreen`, `PreviewScreen`, `ResultScreen`
- `RootStackParamList.Preview` uses `tracks: Track[]` — `HomeScreen` passes `tracks` from `generatePlaylist()` which returns `Track[]` ✓
- `RootStackParamList.Result` uses `addedCount`, `skipped`, `playlistUrl` — `PreviewScreen` passes `result.added_count`, `result.skipped`, `result.playlist_url` from `addToSpotify()` which returns `{ added_count, skipped, playlist_url }` ✓
- `connectSpotify`, `isConnected`, `getAccessToken`, `disconnect` all exported from `spotify.ts` and imported correctly in screens ✓
