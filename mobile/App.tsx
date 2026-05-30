import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_700Bold,
  Fraunces_400Regular_Italic,
  Fraunces_900Black_Italic,
} from '@expo-google-fonts/fraunces';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import HomeScreen from './screens/HomeScreen';
import PreviewScreen from './screens/PreviewScreen';
import ResultScreen from './screens/ResultScreen';
import { colors, fonts } from './theme';

export type Track = { song: string; artist: string };

export type RootStackParamList = {
  Home: undefined;
  Preview: { tracks: Track[]; playlistName: string };
  Result: { addedCount: number; skipped: string[]; playlistUrl: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RESET_AFTER_BACKGROUND_MS = 5 * 60 * 1000;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const backgroundedAt = useRef<number | null>(null);

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    Fraunces_900Black_Italic,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const onReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onReady}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.inkMid,
          headerShadowVisible: false,
          headerTitleStyle: {
            fontFamily: fonts.serifItalic,
            fontSize: 15,
            color: colors.inkMid,
          },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: '',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Preview" component={PreviewScreen} options={{ title: 'side a · preview' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
