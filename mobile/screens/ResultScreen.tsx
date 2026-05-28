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
