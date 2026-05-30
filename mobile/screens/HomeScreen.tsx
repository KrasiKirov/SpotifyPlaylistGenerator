import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { generatePlaylist } from '../services/api';
import { connectSpotify, isConnected } from '../services/spotify';
import { colors, shadow } from '../theme';

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
      Alert.alert('', 'Describe your playlist first.');
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
      <View style={styles.connectScreen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <View style={styles.logoBlock}>
          <Text style={styles.logoMark}>♫</Text>
          <Text style={styles.appName}>Playlist{'\n'}Generator</Text>
        </View>
        <Text style={styles.connectHint}>Connect your Spotify to begin</Text>
        <TouchableOpacity style={[styles.connectBtn, shadow.green]} onPress={handleConnect} activeOpacity={0.8}>
          <Text style={styles.connectBtnText}>Connect Spotify</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <Text style={styles.sectionLabel}>DESCRIBE YOUR VIBE</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="late night drive through the city..."
        placeholderTextColor={colors.dim}
        value={prompt}
        onChangeText={setPrompt}
        multiline
        returnKeyType="done"
      />

      <Text style={styles.sectionLabel}>REFINE  <Text style={styles.sectionLabelOptional}>optional</Text></Text>
      <View style={styles.row}>
        <TextInput style={styles.chipInput} placeholder="genre" placeholderTextColor={colors.dim} value={genre} onChangeText={setGenre} />
        <TextInput style={styles.chipInput} placeholder="decade" placeholderTextColor={colors.dim} value={decade} onChangeText={setDecade} />
        <TextInput style={styles.chipInput} placeholder="mood" placeholderTextColor={colors.dim} value={mood} onChangeText={setMood} />
      </View>

      <View style={styles.countRow}>
        <Text style={styles.sectionLabel}>SONGS</Text>
        <Text style={styles.countNum}>{count}</Text>
      </View>
      <Slider
        minimumValue={1}
        maximumValue={50}
        step={1}
        value={count}
        onValueChange={(v) => setCount(Math.round(v))}
        minimumTrackTintColor={colors.green}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.green}
        style={styles.slider}
      />

      <TouchableOpacity
        style={[styles.generateBtn, loading && styles.disabled, shadow.green]}
        onPress={handleGenerate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.generateBtnText}>Generate Playlist</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, gap: 12, paddingBottom: 48 },

  connectScreen: {
    flex: 1, backgroundColor: colors.bg,
    justifyContent: 'center', alignItems: 'center', padding: 32, gap: 24,
  },
  logoBlock: { alignItems: 'center', gap: 8, marginBottom: 16 },
  logoMark: { fontSize: 48, color: colors.green },
  appName: {
    fontSize: 36, fontWeight: '800', color: colors.white,
    textAlign: 'center', lineHeight: 40, letterSpacing: -1,
  },
  connectHint: { fontSize: 14, color: colors.muted, letterSpacing: 0.3 },
  connectBtn: {
    backgroundColor: colors.green, paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 50, marginTop: 8,
  },
  connectBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.muted,
    letterSpacing: 2, marginBottom: 4,
  },
  sectionLabelOptional: {
    fontSize: 10, fontWeight: '400', color: colors.dim,
    letterSpacing: 1, textTransform: 'lowercase',
  },
  promptInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, fontSize: 17, color: colors.white,
    minHeight: 90, textAlignVertical: 'top', lineHeight: 24,
  },
  row: { flexDirection: 'row', gap: 8 },
  chipInput: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    fontSize: 13, color: colors.white, textAlign: 'center',
  },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -4 },
  countNum: { fontSize: 14, fontWeight: '600', color: colors.green, fontFamily: 'Courier New' },
  slider: { marginHorizontal: -4 },
  generateBtn: {
    backgroundColor: colors.green, paddingVertical: 18,
    borderRadius: 50, alignItems: 'center', marginTop: 8,
  },
  generateBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  disabled: { opacity: 0.4 },
});
