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
