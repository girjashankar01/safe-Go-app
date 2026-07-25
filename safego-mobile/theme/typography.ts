import { TextStyle } from 'react-native';

type TypographyScale = Record<string, TextStyle>;

export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37, lineHeight: 41, fontFamily: undefined },
  title1:     { fontSize: 28, fontWeight: '600', letterSpacing: 0.36, lineHeight: 34, fontFamily: undefined },
  title2:     { fontSize: 22, fontWeight: '600', letterSpacing: -0.26, lineHeight: 28, fontFamily: undefined },
  title3:     { fontSize: 20, fontWeight: '600', letterSpacing: -0.45, lineHeight: 25, fontFamily: undefined },
  headline:   { fontSize: 17, fontWeight: '600', letterSpacing: -0.43, lineHeight: 22, fontFamily: undefined },
  body:       { fontSize: 17, fontWeight: '400', letterSpacing: -0.43, lineHeight: 22, fontFamily: undefined },
  callout:    { fontSize: 16, fontWeight: '400', letterSpacing: -0.31, lineHeight: 21, fontFamily: undefined },
  subhead:    { fontSize: 15, fontWeight: '400', letterSpacing: -0.24, lineHeight: 20, fontFamily: undefined },
  footnote:   { fontSize: 13, fontWeight: '400', letterSpacing: -0.08, lineHeight: 18, fontFamily: undefined },
  caption1:   { fontSize: 12, fontWeight: '400', letterSpacing: 0, lineHeight: 16, fontFamily: undefined },
  caption2:   { fontSize: 11, fontWeight: '400', letterSpacing: 0.07, lineHeight: 13, fontFamily: undefined },
} as const satisfies TypographyScale;
