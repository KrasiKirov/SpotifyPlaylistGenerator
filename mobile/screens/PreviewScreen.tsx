import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { addToSpotify } from '../services/api';
import { getAccessToken, disconnect } from '../services/spotify';

type Props = NativeStackScreenProps<RootStackParamList, 'Preview'>;

export default function PreviewScreen({ route, navigation }: Props) {
  const { tracks, playlistName } = route.params;
  const [name, setName] = useState(playlistName);
  const [currentTracks, setCurrentTracks] = useState(tracks);
  const [loading, setLoading] = useState(false);

  function removeTrack(index: number) {
    setCurrentTracks(t => t.filter((_, i) => i !== index));
  }

  async function handleAdd() {
    if (currentTracks.length === 0) {
      Alert.alert('No songs', 'Add at least one song before saving.');
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const result = await addToSpotify({
        playlist_name: name.trim() || playlistName,
        tracks: currentTracks,
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
      <View style={styles.nameRow}>
        <Text style={styles.nameLabel}>Playlist name</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Playlist name"
          returnKeyType="done"
        />
      </View>
      <FlatList
        data={currentTracks}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.track}>
            <Text style={styles.number}>{index + 1}.</Text>
            <View style={styles.trackInfo}>
              <Text style={styles.song}>{item.song}</Text>
              <Text style={styles.artist}>{item.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => removeTrack(index)} hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </TouchableOpacity>
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
  remove: { fontSize: 16, color: '#ccc', paddingHorizontal: 4 },
  trackInfo: { flex: 1 },
  song: { fontSize: 16, fontWeight: '500', color: '#111' },
  artist: { fontSize: 14, color: '#666', marginTop: 2 },
  nameRow: { padding: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  nameLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  nameInput: { fontSize: 16, fontWeight: '500', color: '#111', padding: 0 },
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
