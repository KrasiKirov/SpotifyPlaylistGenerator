import { TextStyle, Platform } from 'react-native';

export const colors = {
  bg: '#15110D',
  bgDeep: '#0E0B08',
  bgVignette: '#1D1813',
  surface: '#1F1A14',
  surfaceHigh: '#2A231B',
  parchment: '#E9DEC9',
  parchmentInk: '#1A1410',
  ink: '#F2E9D8',
  inkMid: '#C9BFAA',
  muted: '#928572',
  dim: '#5D5446',
  hairline: '#3A3127',
  hairlineSoft: '#2A2219',
  brass: '#C9A65B',
  brassBright: '#E2C076',
  brassDeep: '#8F7333',
  oxblood: '#7A2230',
};

export const fonts = {
  serif: 'Fraunces_400Regular',
  serifMedium: 'Fraunces_500Medium',
  serifBold: 'Fraunces_700Bold',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBlackItalic: 'Fraunces_900Black_Italic',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
};

const tracked = (n: number): TextStyle => ({ letterSpacing: n });

export const type = {
  displayXL: {
    fontFamily: fonts.serifBlackItalic,
    fontSize: 56,
    lineHeight: 58,
    color: colors.ink,
    ...tracked(-1.8),
  } as TextStyle,
  display: {
    fontFamily: fonts.serifBold,
    fontSize: 40,
    lineHeight: 44,
    color: colors.ink,
    ...tracked(-1.2),
  } as TextStyle,
  displayItalic: {
    fontFamily: fonts.serifBlackItalic,
    fontSize: 40,
    lineHeight: 44,
    color: colors.ink,
    ...tracked(-1.4),
  } as TextStyle,
  headline: {
    fontFamily: fonts.serifMedium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    ...tracked(-0.4),
  } as TextStyle,
  bodySerif: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  } as TextStyle,
  caption: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  } as TextStyle,
  micro: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 14,
    color: colors.muted,
    ...tracked(2.4),
    textTransform: 'uppercase' as const,
  } as TextStyle,
  microBrass: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    lineHeight: 14,
    color: colors.brass,
    ...tracked(2.4),
    textTransform: 'uppercase' as const,
  } as TextStyle,
  numeral: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.brass,
    ...tracked(1),
  } as TextStyle,
};

export const shadow = {
  brass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const radii = {
  sharp: 2,
  small: 4,
  card: 6,
  pill: 999,
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const hairline = Platform.select({ ios: 0.5, android: 1, default: 1 })!;
