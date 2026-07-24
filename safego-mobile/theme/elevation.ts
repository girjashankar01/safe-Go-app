import { Platform, ViewStyle } from 'react-native';
import { lightColors, darkColors } from './colors';

export const getElevation = (isDark: boolean): ViewStyle => {
  if (isDark) {
    return {
      borderWidth: 1,
      borderColor: darkColors.border,
      shadowColor: 'transparent',
      elevation: 0,
    };
  }

  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: lightColors.border,
  };
};
