import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ViewStyle, TextStyle } from 'react-native';
import { useTheme, radius, typography, spacing } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'danger' | 'errorContainer' | 'outline' | 'ghost';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  variant = 'primary', 
  style, 
  textStyle, 
  icon,
  ...rest 
}) => {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    if (variant === 'primary') return colors.primary;
    if (variant === 'danger') return colors.error || colors.danger;
    if (variant === 'errorContainer') return colors.errorContainer;
    return 'transparent';
  };

  const getTextColor = () => {
    if (variant === 'primary' || variant === 'danger') return '#FFFFFF';
    if (variant === 'errorContainer') return colors.error;
    if (variant === 'outline') return colors.onSurface || colors.text;
    return colors.primary; // ghost
  };

  const getBorderColor = () => {
    if (variant === 'outline') return colors.border;
    return 'transparent';
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          borderRadius: radius.button,
        },
        style,
      ]}
      activeOpacity={0.8}
      {...rest}
    >
      {icon && React.cloneElement(icon as React.ReactElement, { color: getTextColor() })}
      <Text
        style={[
          styles.text,
          {
            color: getTextColor(),
            ...typography.callout,
            fontWeight: '600',
            marginLeft: icon ? spacing.sm : 0,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
