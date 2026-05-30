import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { addToSpotify } from '../services/api';
import { getAccessToken, disconnect } from '../services/spotify';
import { colors, shadow } from '../theme';

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
      Alert.alert('', 'Add at least one song before saving.');
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
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <Text style={styles.nameLabel}>PLAYLIST NAME</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="My Playlist"
          placeholderTextColor={colors.dim}
          returnKeyType="done"
        />
        <Text style={styles.trackCount}>{currentTracks.length} tracks</Text>
      </View>

      <FlatList
        data={currentTracks}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          <View style={styles.track}>
            <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.trackInfo}>
              <Text style={styles.song} numberOfLines={1}>{item.song}</Text>
              <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => removeTrack(index)} hitSlop={12} style={styles.removeBtn}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.secondaryText}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addBtn, loading && styles.disabled, shadow.green]}
          onPress={handleAdd}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={styles.addBtnText}>Add to Spotify</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  nameLabel: {
    fontSize: 10, fontWeight: '700', color: colors.muted,
    letterSpacing: 2, marginBottom: 6,
  },
  nameInput: {
    fontSize: 22, fontWeight: '700', color: colors.white,
    letterSpacing: -0.5, padding: 0,
  },
  trackCount: {
    fontSize: 12, color: colors.muted, marginTop: 6,
    fontFamily: 'Courier New',
  },

  list: { paddingVertical: 8 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
  track: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 24, gap: 16,
  },
  number: {
    fontSize: 13, color: colors.muted, width: 28,
    fontFamily: 'Courier New', letterSpacing: 0.5,
  },
  trackInfo: { flex: 1 },
  song: { fontSize: 15, fontWeight: '600', color: colors.white, letterSpacing: -0.2 },
  artist: { fontSize: 13, color: colors.muted, marginTop: 2 },
  removeBtn: { padding: 4 },
  removeText: { fontSize: 14, color: colors.border },

  footer: {
    flexDirection: 'row', padding: 16, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  addBtn: {
    flex: 2, backgroundColor: colors.green,
    paddingVertical: 16, borderRadius: 50, alignItems: 'center',
  },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  secondary: {
    flex: 1, backgroundColor: colors.surface,
    paddingVertical: 16, borderRadius: 50, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  disabled: { opacity: 0.4 },
});
