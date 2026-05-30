import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Linking, StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { colors, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { addedCount, skipped, playlistUrl } = route.params;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.badge}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={styles.title}>Done.</Text>
      <Text style={styles.subtitle}>
        <Text style={styles.countHighlight}>{addedCount} tracks</Text>
        {' '}saved to Spotify.
      </Text>

      {skipped.length > 0 && (
        <View style={styles.skippedBlock}>
          <TouchableOpacity onPress={() => setShowSkipped(!showSkipped)} style={styles.skippedToggleRow}>
            <Text style={styles.skippedToggle}>
              {skipped.length} not found on Spotify
            </Text>
            <Text style={styles.skippedChevron}>{showSkipped ? '▴' : '▾'}</Text>
          </TouchableOpacity>
          {showSkipped && (
            <FlatList
              data={skipped}
              keyExtractor={(_, i) => String(i)}
              style={styles.skippedList}
              renderItem={({ item }) => <Text style={styles.skippedItem}>— {item}</Text>}
            />
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, shadow.green]}
          onPress={() => Linking.openURL(playlistUrl)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Open in Spotify</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Make Another</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },

  badge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.green,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  checkmark: { fontSize: 36, color: colors.green },

  title: {
    fontSize: 48, fontWeight: '800', color: colors.white,
    letterSpacing: -2, lineHeight: 52,
  },
  subtitle: { fontSize: 17, color: colors.muted, textAlign: 'center' },
  countHighlight: { color: colors.white, fontWeight: '700' },

  skippedBlock: {
    width: '100%', backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  skippedToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skippedToggle: { fontSize: 13, color: colors.muted },
  skippedChevron: { fontSize: 12, color: colors.muted },
  skippedList: { marginTop: 10, maxHeight: 120 },
  skippedItem: { fontSize: 13, color: colors.dim, paddingVertical: 2, fontFamily: 'Courier New' },

  actions: { width: '100%', gap: 10, marginTop: 8 },
  primaryBtn: {
    backgroundColor: colors.green, paddingVertical: 18,
    borderRadius: 50, alignItems: 'center',
  },
  primaryBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: colors.surface, paddingVertical: 16,
    borderRadius: 50, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.muted },
});
