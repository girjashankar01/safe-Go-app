import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { useTheme, radius, typography, spacing, getElevation } from '../../theme';
import { LucideIcon } from 'lucide-react-native';

interface ActionCardProps extends TouchableOpacityProps {
  label: string;
  Icon: LucideIcon;
}

export const ActionCard: React.FC<ActionCardProps> = ({ label, Icon, style, ...rest }) => {
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
      <Icon color={colors.primary} size={32} strokeWidth={2} />
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
    flex: 1,
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
