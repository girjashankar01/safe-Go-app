export type ThemePalette = {
  background: string;
  surface: string;
  card: string;
  border: string;
  primary: string;
  danger: string;
  text: string;
  secondaryText: string;
  divider: string;
};

export const lightColors: ThemePalette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E5E7EB',
  primary: '#16A34A',
  danger: '#EF4444',
  text: '#111827',
  secondaryText: '#6B7280',
  divider: '#E5E7EB',
};

export const darkColors: ThemePalette = {
  background: '#121212',
  surface: '#1E1E1E',
  card: '#242424',
  border: '#303030',
  primary: '#22C55E',
  danger: '#FF4D4F',
  text: '#FFFFFF',
  secondaryText: '#B3B3B3',
  divider: '#2E2E2E',
};
