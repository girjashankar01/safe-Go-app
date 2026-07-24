import React from 'react';
import { View, ViewStyle, StyleSheet, ViewProps } from 'react-native';
import { useTheme, radius, spacing, getElevation } from '../../theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, noPadding = false, ...rest }) => {
  const { colors, isDark } = useTheme();
  
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          padding: noPadding ? 0 : spacing.lg,
        },
        getElevation(isDark),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
  },
});
