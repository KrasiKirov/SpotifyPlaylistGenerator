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
