import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, Linking, StatusBar, SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../App';
import { colors, fonts, spacing, hairline, shadow, radii } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { addedCount, skipped, playlistUrl } = route.params;
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDeep} />
      <LinearGradient
        colors={[colors.bgDeep, colors.bg, colors.bgVignette]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topRule}>
          <View style={styles.rule} />
          <Text style={styles.kicker}>pressed · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase()}</Text>
          <View style={styles.rule} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.numeral}>fin. № {String(addedCount).padStart(2, '0')}</Text>

          <Text style={styles.headline}>
            The side{'\n'}
            <Text style={styles.italicAccent}>is set.</Text>
          </Text>

          <View style={styles.ornamentRow}>
            <View style={styles.ruleShort} />
            <Text style={styles.ornament}>✦</Text>
            <View style={styles.ruleShort} />
          </View>

          <Text style={styles.body}>
            <Text style={styles.bodyAccent}>{addedCount}</Text> tracks have been{' '}
            <Text style={styles.bodyItalic}>quietly delivered</Text> to your library.
            {skipped.length > 0 && (
              <> A small number eluded the search — see below.</>
            )}
          </Text>

          {skipped.length > 0 && (
            <View style={styles.skippedBlock}>
              <Pressable onPress={() => setShowSkipped(!showSkipped)} style={styles.skippedToggle}>
                <Text style={styles.skippedRoman}>·</Text>
                <Text style={styles.skippedToggleText}>
                  {skipped.length} unaccounted for
                </Text>
                <Text style={styles.skippedChev}>{showSkipped ? '–' : '+'}</Text>
              </Pressable>
              {showSkipped && (
                <View style={styles.skippedList}>
                  {skipped.map((s, i) => (
                    <Text key={`${i}__${s}`} style={styles.skippedItem}>
                      <Text style={styles.skippedHyphen}>— </Text>{s}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={() => Linking.openURL(playlistUrl)}
            style={({ pressed }) => [
              styles.primaryBtn, shadow.brass,
              pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
            ]}
          >
            <Text style={styles.primaryBtnText}>Take to Spotify</Text>
            <Text style={styles.primaryBtnArrow}>↗</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.popToTop()}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.55 }]}
          >
            <Text style={styles.secondaryBtnText}>compose another</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  safe: { flex: 1, paddingHorizontal: spacing.l },

  topRule: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: spacing.l, paddingHorizontal: spacing.s,
  },
  rule: { flex: 1, height: hairline, backgroundColor: colors.hairline },
  kicker: {
    fontFamily: fonts.mono, fontSize: 9, color: colors.brass,
    letterSpacing: 2.4, textTransform: 'uppercase',
  },

  content: {
    flexGrow: 1, justifyContent: 'center',
    paddingVertical: spacing.xxl, gap: spacing.l,
  },
  numeral: {
    fontFamily: fonts.serifItalic, fontSize: 13, color: colors.brass,
    letterSpacing: 1,
  },
  headline: {
    fontFamily: fonts.serifBold, fontSize: 64, lineHeight: 64,
    color: colors.ink, letterSpacing: -2.4,
  },
  italicAccent: {
    fontFamily: fonts.serifBlackItalic, color: colors.brassBright,
  },
  ornamentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
  },
  ruleShort: { width: 38, height: hairline, backgroundColor: colors.brassDeep },
  ornament: { color: colors.brass, fontSize: 13 },
  body: {
    fontFamily: fonts.serif, fontSize: 17, lineHeight: 26,
    color: colors.inkMid, maxWidth: 340,
  },
  bodyAccent: { fontFamily: fonts.serifBold, color: colors.ink },
  bodyItalic: { fontFamily: fonts.serifItalic, color: colors.ink },

  skippedBlock: {
    marginTop: spacing.s,
    borderTopWidth: hairline, borderBottomWidth: hairline,
    borderColor: colors.hairline,
    paddingVertical: spacing.s,
  },
  skippedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  skippedRoman: {
    fontFamily: fonts.serifItalic, fontSize: 16, color: colors.brass, width: 14,
  },
  skippedToggleText: {
    flex: 1,
    fontFamily: fonts.serifItalic, fontSize: 14, color: colors.inkMid,
  },
  skippedChev: {
    fontFamily: fonts.serifMedium, fontSize: 18, color: colors.brass, width: 18, textAlign: 'right',
  },
  skippedList: { paddingTop: 8, paddingLeft: 22, gap: 6 },
  skippedItem: {
    fontFamily: fonts.serif, fontSize: 13, lineHeight: 19, color: colors.muted,
  },
  skippedHyphen: { fontFamily: fonts.serifItalic, color: colors.brassDeep },

  actions: { paddingBottom: spacing.l, gap: spacing.s },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.brass,
    paddingVertical: 20, paddingHorizontal: spacing.l,
    borderRadius: radii.sharp,
  },
  primaryBtnText: {
    fontFamily: fonts.serifBold, fontSize: 18, color: colors.bgDeep,
    letterSpacing: -0.4,
  },
  primaryBtnArrow: { fontFamily: fonts.serif, fontSize: 20, color: colors.bgDeep },
  secondaryBtn: {
    paddingVertical: 16, alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.serifItalic, fontSize: 14, color: colors.muted,
    textDecorationLine: 'underline', textDecorationColor: colors.brassDeep,
  },
});
