import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  Pressable, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { addToSpotify } from '../services/api';
import { getAccessToken, disconnect } from '../services/spotify';
import { colors, fonts, spacing, hairline, shadow, radii } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Preview'>;

const ROMAN = [
  'I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.', 'VIII.', 'IX.', 'X.',
  'XI.', 'XII.', 'XIII.', 'XIV.', 'XV.', 'XVI.', 'XVII.', 'XVIII.', 'XIX.', 'XX.',
  'XXI.', 'XXII.', 'XXIII.', 'XXIV.', 'XXV.', 'XXVI.', 'XXVII.', 'XXVIII.', 'XXIX.', 'XXX.',
  'XXXI.', 'XXXII.', 'XXXIII.', 'XXXIV.', 'XXXV.', 'XXXVI.', 'XXXVII.', 'XXXVIII.', 'XXXIX.', 'XL.',
  'XLI.', 'XLII.', 'XLIII.', 'XLIV.', 'XLV.', 'XLVI.', 'XLVII.', 'XLVIII.', 'XLIX.', 'L.',
];

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
      Alert.alert('A moment', 'A side must hold at least one track.');
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
        Alert.alert('Session lapsed', 'Pair with Spotify again to continue.', [
          { text: 'Very well', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Couldn’t save', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>side a · {String(currentTracks.length).padStart(2, '0')} tracks</Text>
          <Text style={styles.duration}>~{String(currentTracks.length * 3).padStart(2, '0')} min</Text>
        </View>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Untitled folio"
          placeholderTextColor={colors.dim}
          returnKeyType="done"
        />
        <Text style={styles.namePencil}>— a working title, edit at will</Text>
      </View>

      <FlatList
        data={currentTracks}
        keyExtractor={(item, i) => `${i}__${item.song}__${item.artist}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={() => (
          <View style={styles.listFooter}>
            <View style={styles.ruleShort} />
            <Text style={styles.endmark}>fin.</Text>
            <View style={styles.ruleShort} />
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.track}>
            <Text style={styles.roman}>{ROMAN[index] ?? `${index + 1}.`}</Text>
            <View style={styles.trackInfo}>
              <Text style={styles.song} numberOfLines={1}>{item.song}</Text>
              <Text style={styles.artist} numberOfLines={1}>
                <Text style={styles.artistDash}>by </Text>{item.artist}
              </Text>
            </View>
            <Pressable
              onPress={() => removeTrack(index)}
              hitSlop={14}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.4 }]}
            >
              <Text style={styles.removeText}>strike</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.secondaryText}>← reconsider</Text>
        </Pressable>
        <Pressable
          onPress={handleAdd}
          disabled={loading}
          style={({ pressed }) => [
            styles.addBtn, shadow.brass,
            pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
            loading && { opacity: 0.45 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.bgDeep} size="small" />
          ) : (
            <>
              <Text style={styles.addBtnText}>Press to Spotify</Text>
              <Text style={styles.addBtnArrow}>↗</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.l, paddingTop: spacing.l, paddingBottom: spacing.m,
    borderBottomWidth: hairline, borderBottomColor: colors.hairlineSoft,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  eyebrow: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.brass,
    letterSpacing: 3, textTransform: 'uppercase',
  },
  duration: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.muted,
    letterSpacing: 2, textTransform: 'lowercase',
  },
  nameInput: {
    fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink,
    letterSpacing: -1, padding: 0, marginTop: 2,
  },
  namePencil: {
    fontFamily: fonts.serifItalic, fontSize: 12, color: colors.muted,
  },

  list: { paddingTop: spacing.s, paddingBottom: spacing.l },
  separator: { height: hairline, backgroundColor: colors.hairlineSoft, marginLeft: 64 },

  track: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: spacing.l, gap: 14,
  },
  roman: {
    fontFamily: fonts.serifItalic, fontSize: 15, color: colors.brass,
    width: 42, letterSpacing: 0.4,
  },
  trackInfo: { flex: 1, gap: 3 },
  song: {
    fontFamily: fonts.serifMedium, fontSize: 17, color: colors.ink,
    letterSpacing: -0.3,
  },
  artist: {
    fontFamily: fonts.serif, fontSize: 13, color: colors.inkMid,
  },
  artistDash: { fontFamily: fonts.serifItalic, color: colors.muted },
  removeBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  removeText: {
    fontFamily: fonts.serifItalic, fontSize: 12, color: colors.muted,
    textDecorationLine: 'underline', textDecorationColor: colors.brassDeep,
  },

  listFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: spacing.l, paddingHorizontal: spacing.xl,
  },
  ruleShort: { flex: 1, height: hairline, backgroundColor: colors.hairline },
  endmark: {
    fontFamily: fonts.serifItalic, fontSize: 13, color: colors.brass,
    letterSpacing: 1,
  },

  footer: {
    flexDirection: 'row', alignItems: 'stretch',
    paddingHorizontal: spacing.l, paddingTop: spacing.m, paddingBottom: spacing.l,
    gap: spacing.s,
    borderTopWidth: hairline, borderTopColor: colors.hairlineSoft,
    backgroundColor: colors.bg,
  },
  secondary: {
    paddingVertical: 18, paddingHorizontal: spacing.m,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: hairline, borderColor: colors.hairline,
    borderRadius: radii.sharp,
  },
  secondaryText: {
    fontFamily: fonts.serifItalic, fontSize: 14, color: colors.inkMid,
  },
  addBtn: {
    flex: 1, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.brass,
    paddingVertical: 18, paddingHorizontal: spacing.l,
    borderRadius: radii.sharp,
  },
  addBtnText: {
    fontFamily: fonts.serifBold, fontSize: 16, color: colors.bgDeep,
    letterSpacing: -0.3,
  },
  addBtnArrow: { fontFamily: fonts.serif, fontSize: 18, color: colors.bgDeep },
});
