import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, View } from 'react-native';
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
          backgroundColor: colors.surfaceVariant, // Judgment call
          borderRadius: radius.card,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        style,
      ]}
      activeOpacity={0.7}
      {...rest}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
        <Feather name={iconName} color={colors.primary} size={20} />
      </View>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  label: {
    marginLeft: spacing.sm,
    flex: 1,
    textAlign: 'left',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
