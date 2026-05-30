import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
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

const RESET_AFTER_BACKGROUND_MS = 5 * 60 * 1000;

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (nextState === 'active' && navigationRef.isReady()) {
        const ts = backgroundedAt.current;
        backgroundedAt.current = null;
        if (ts !== null && Date.now() - ts >= RESET_AFTER_BACKGROUND_MS) {
          navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
        }
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#0C0C0C' },
          headerTintColor: '#F0EDE8',
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', letterSpacing: -0.3, fontSize: 16 },
          contentStyle: { backgroundColor: '#0C0C0C' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Playlist Generator' }} />
        <Stack.Screen name="Preview" component={PreviewScreen} options={{ title: 'Preview Songs' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Done!' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
