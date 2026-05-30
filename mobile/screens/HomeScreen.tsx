import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  Pressable, ActivityIndicator, Alert, StatusBar, SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../App';
import { generatePlaylist } from '../services/api';
import { connectSpotify, isConnected } from '../services/spotify';
import { colors, type, spacing, radii, hairline, shadow, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [connected, setConnected] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('');
  const [decade, setDecade] = useState('');
  const [mood, setMood] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      isConnected().then(v => { if (!cancelled) setConnected(v); });
      return () => { cancelled = true; };
    }, [])
  );

  async function handleConnect() {
    try {
      await connectSpotify();
      setConnected(true);
    } catch (e: any) {
      Alert.alert('Unable to connect', e.message);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      Alert.alert('A moment', 'Describe the evening you have in mind.');
      return;
    }
    setLoading(true);
    try {
      const tracks = await generatePlaylist({ prompt, count, genre, decade, mood });
      navigation.navigate('Preview', { tracks, playlistName: prompt });
    } catch (e: any) {
      Alert.alert('Couldn’t generate', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <View style={styles.connectScreen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bgDeep} />
        <LinearGradient
          colors={[colors.bgDeep, colors.bg, colors.bgVignette]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.connectSafe}>
          <View style={styles.connectTopRule}>
            <View style={styles.rule} />
            <Text style={styles.monogram}>k · k</Text>
            <View style={styles.rule} />
          </View>

          <View style={styles.connectBody}>
            <Text style={styles.eyebrow}>est. an evening at a time</Text>
            <Text style={styles.connectDisplay}>
              The{'\n'}
              <Text style={styles.italicAccent}>listening{'\n'}room.</Text>
            </Text>
            <View style={styles.ornamentRow}>
              <View style={styles.ruleShort} />
              <Text style={styles.ornament}>✦</Text>
              <View style={styles.ruleShort} />
            </View>
            <Text style={styles.connectLede}>
              A quiet correspondent for the records you haven’t yet met. Tell it the mood; it
              will assemble the side.
            </Text>
          </View>

          <View style={styles.connectFooter}>
            <Pressable
              onPress={handleConnect}
              style={({ pressed }) => [styles.connectBtn, pressed && styles.pressed]}
            >
              <Text style={styles.connectBtnNum}>I.</Text>
              <Text style={styles.connectBtnText}>Pair with Spotify</Text>
              <Text style={styles.connectBtnArrow}>↗</Text>
            </Pressable>
            <Text style={styles.fineprint}>
              authorised via spotify · oauth pkce · scope: <Text style={styles.fineprintItalic}>playlist-modify-private</Text>
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.masthead}>
          <Text style={styles.eyebrow}>folio №01 · for tonight</Text>
          <Text style={styles.mastheadTitle}>
            Compose <Text style={styles.italicAccent}>a side.</Text>
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionRoman}>I.</Text>
            <Text style={styles.sectionLabel}>the brief</Text>
          </View>
          <View style={styles.parchment}>
            <TextInput
              style={styles.promptInput}
              placeholder="late drive home through the rain&#10;after a long film…"
              placeholderTextColor="#8A7B66"
              value={prompt}
              onChangeText={setPrompt}
              multiline
              returnKeyType="done"
            />
            <Text style={styles.parchmentSig}>— prompt</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionRoman}>II.</Text>
            <Text style={styles.sectionLabel}>refinements <Text style={styles.sectionLabelOptional}>(if any)</Text></Text>
          </View>
          <View style={styles.refineRow}>
            <RefineField label="genre" value={genre} onChangeText={setGenre} placeholder="bossa" />
            <RefineField label="decade" value={decade} onChangeText={setDecade} placeholder="'70s" />
            <RefineField label="mood" value={mood} onChangeText={setMood} placeholder="hushed" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionRoman}>III.</Text>
            <Text style={styles.sectionLabel}>length of the side</Text>
            <View style={styles.flex1} />
            <Text style={styles.lengthValue}>{String(count).padStart(2, '0')}<Text style={styles.lengthSuffix}> tracks</Text></Text>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={50}
            step={1}
            value={count}
            onValueChange={(v) => setCount(Math.round(v))}
            minimumTrackTintColor={colors.brass}
            maximumTrackTintColor={colors.hairline}
            thumbTintColor={colors.brassBright}
            style={styles.slider}
          />
          <View style={styles.tickRow}>
            <Text style={styles.tick}>1</Text>
            <Text style={styles.tick}>—</Text>
            <Text style={styles.tick}>50</Text>
          </View>
        </View>

        <Pressable
          onPress={handleGenerate}
          disabled={loading}
          style={({ pressed }) => [
            styles.generateBtn,
            shadow.brass,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.bgDeep} />
          ) : (
            <>
              <Text style={styles.generateBtnText}>Compose the side</Text>
              <Text style={styles.generateBtnArrow}>→</Text>
            </>
          )}
        </Pressable>

        <View style={styles.colophon}>
          <View style={styles.rule} />
          <Text style={styles.colophonText}>
            <Text style={styles.colophonItalic}>set in fraunces & plex mono</Text>{'  ·  '}
            <Text>composed locally · pressed in stockholm</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function RefineField({
  label, value, onChangeText, placeholder,
}: { label: string; value: string; onChangeText: (s: string) => void; placeholder: string }) {
  return (
    <View style={styles.refineField}>
      <Text style={styles.refineLabel}>{label}</Text>
      <TextInput
        style={styles.refineInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5E5443"
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.45 },

  // ── Connect screen ─────────────────────────────────────────
  connectScreen: { flex: 1, backgroundColor: colors.bgDeep },
  connectSafe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  connectTopRule: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.xl,
  },
  rule: { flex: 1, height: hairline, backgroundColor: colors.hairline },
  ruleShort: { width: 32, height: hairline, backgroundColor: colors.brassDeep },
  monogram: {
    fontFamily: fonts.serifItalic,
    fontSize: 12, color: colors.brass, letterSpacing: 4,
    textTransform: 'lowercase' as const,
  },

  connectBody: { gap: spacing.l, marginTop: -spacing.xxl },
  eyebrow: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.brass,
    letterSpacing: 3, textTransform: 'uppercase',
  },
  connectDisplay: {
    fontFamily: fonts.serifBold, fontSize: 64, lineHeight: 64,
    color: colors.ink, letterSpacing: -2.4,
  },
  italicAccent: {
    fontFamily: fonts.serifBlackItalic, color: colors.brassBright,
  },
  ornamentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
  },
  ornament: { color: colors.brass, fontSize: 12 },
  connectLede: {
    fontFamily: fonts.serif, fontSize: 16, lineHeight: 24,
    color: colors.inkMid, maxWidth: 320,
  },

  connectFooter: { gap: spacing.m, marginBottom: spacing.xl },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'transparent',
    borderTopWidth: hairline, borderBottomWidth: hairline,
    borderColor: colors.brassDeep,
    paddingVertical: 22, paddingHorizontal: 4,
  },
  connectBtnNum: {
    fontFamily: fonts.serifItalic, fontSize: 18, color: colors.brass, width: 28,
  },
  connectBtnText: {
    flex: 1,
    fontFamily: fonts.serifMedium, fontSize: 22, color: colors.ink,
    letterSpacing: -0.4,
  },
  connectBtnArrow: { fontFamily: fonts.serif, fontSize: 20, color: colors.brass },
  fineprint: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.dim,
    letterSpacing: 1.4, textAlign: 'center',
  },
  fineprintItalic: { fontFamily: fonts.serifItalic, fontSize: 11, color: colors.muted },

  // ── Form screen ────────────────────────────────────────────
  container: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl + spacing.s,
    paddingBottom: spacing.xxl,
    gap: spacing.l,
  },

  masthead: { gap: 10, marginBottom: spacing.s, paddingBottom: spacing.m, borderBottomWidth: hairline, borderBottomColor: colors.hairlineSoft },
  mastheadTitle: {
    fontFamily: fonts.serifBold, fontSize: 44, lineHeight: 46,
    color: colors.ink, letterSpacing: -1.6,
  },

  section: { gap: spacing.s },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  sectionRoman: {
    fontFamily: fonts.serifItalic, fontSize: 14, color: colors.brass,
    width: 22,
  },
  sectionLabel: {
    fontFamily: fonts.serifItalic, fontSize: 15, color: colors.inkMid,
    letterSpacing: -0.2,
  },
  sectionLabelOptional: { color: colors.muted, fontSize: 13 },

  // parchment input
  parchment: {
    backgroundColor: colors.parchment,
    borderRadius: radii.card,
    paddingTop: spacing.m, paddingHorizontal: spacing.m, paddingBottom: 10,
    minHeight: 132,
    borderWidth: hairline,
    borderColor: '#C9BB9D',
    ...shadow.soft,
  },
  promptInput: {
    fontFamily: fonts.serif, fontSize: 17, lineHeight: 24,
    color: colors.parchmentInk,
    textAlignVertical: 'top',
    minHeight: 84,
    padding: 0,
  },
  parchmentSig: {
    fontFamily: fonts.serifItalic, fontSize: 12, color: '#9A8868',
    textAlign: 'right',
  },

  // refine row
  refineRow: { flexDirection: 'row', gap: spacing.s },
  refineField: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: hairline, borderBottomColor: colors.hairline,
    gap: 4,
  },
  refineLabel: {
    fontFamily: fonts.serifItalic, fontSize: 11, color: colors.brass,
  },
  refineInput: {
    fontFamily: fonts.serif, fontSize: 16, color: colors.ink,
    padding: 0,
  },

  // length
  lengthValue: {
    fontFamily: fonts.monoMedium, fontSize: 14, color: colors.brass,
    letterSpacing: 1,
  },
  lengthSuffix: { color: colors.muted, fontSize: 11 },
  slider: { marginHorizontal: -4, marginTop: 4 },
  tickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  tick: { fontFamily: fonts.mono, fontSize: 10, color: colors.dim, letterSpacing: 1 },

  // generate button — brass plaque
  generateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.brass,
    paddingVertical: 20, paddingHorizontal: spacing.l,
    borderRadius: radii.sharp,
    marginTop: spacing.m,
  },
  generateBtnText: {
    fontFamily: fonts.serifBold, fontSize: 18, color: colors.bgDeep,
    letterSpacing: -0.4,
  },
  generateBtnArrow: {
    fontFamily: fonts.serif, fontSize: 20, color: colors.bgDeep,
  },

  colophon: { gap: 10, marginTop: spacing.l },
  colophonText: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.dim,
    letterSpacing: 1.4, textAlign: 'center',
  },
  colophonItalic: { fontFamily: fonts.serifItalic, fontSize: 11, color: colors.muted, letterSpacing: 0 },
});
