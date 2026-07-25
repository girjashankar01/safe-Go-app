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
      <Feather name={iconName} color={colors.text} size={22} />
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
            ...typography.subhead,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  label: {
    marginLeft: spacing.sm,
    flex: 1,
    textAlign: 'left',
  },
});
