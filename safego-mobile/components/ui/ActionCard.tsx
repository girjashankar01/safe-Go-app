import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { useTheme, radius, typography, spacing, getElevation } from '../../theme';
import { Feather } from '@expo/vector-icons';

interface ActionCardProps extends TouchableOpacityProps {
  label: string;
  iconName: keyof typeof Feather.glyphMap;
}

export const ActionCard: React.FC<ActionCardProps> = ({ label, iconName, style, ...rest }) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          ...getElevation(isDark),
        },
        style,
      ]}
      activeOpacity={0.7}
      {...rest}
    >
      <Feather name={iconName} color={colors.primary} size={32} />
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
            fontSize: typography.sizes.body,
            fontWeight: typography.weights.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  label: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
