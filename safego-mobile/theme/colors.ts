export type ThemePalette = {
  background: string;
  surface: string;
  card: string;
  border: string;
  primary: string;
  danger: string;
  accent: string;
  text: string;
  secondaryText: string;
  divider: string;
  // M3 specific tokens
  primaryContainer: string;
  onPrimary: string;
  error: string;
  errorContainer: string;
  success: string;
  successContainer: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
};

export const lightColors: ThemePalette = {
  // M3 Tokens
  primary: '#0F766E',
  primaryContainer: '#CCFBF1',
  onPrimary: '#FFFFFF',
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  success: '#4D9375',
  successContainer: '#E3F2EC',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceVariant: '#F0F4F3',
  onSurface: '#1A1C1C',
  onSurfaceVariant: '#5C6564',
  outline: '#DDE4E2',

  // Legacy mappings to preserve components without breaking
  card: '#FFFFFF',
  border: '#DDE4E2',
  danger: '#DC2626',
  accent: '#0F766E',
  text: '#1A1C1C',
  secondaryText: '#5C6564',
  divider: '#DDE4E2',
};

export const darkColors: ThemePalette = {
  // M3 Tokens
  primary: '#5EEAD4',
  primaryContainer: '#134E4A',
  onPrimary: '#003732',
  error: '#F87171',
  errorContainer: '#450A0A',
  success: '#7FBFA0',
  successContainer: '#1C3D30',
  background: '#0F1414',
  surface: '#1A2120',
  surfaceVariant: '#242E2D',
  onSurface: '#E1E3E2',
  onSurfaceVariant: '#9CA6A4',
  outline: '#3A4443',

  // Legacy mappings
  card: '#1A2120',
  border: '#3A4443',
  danger: '#F87171',
  accent: '#5EEAD4',
  text: '#E1E3E2',
  secondaryText: '#9CA6A4',
  divider: '#3A4443',
};
