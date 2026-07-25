import React from 'react';
import { Text, StyleSheet, TouchableOpacityProps, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, radius, typography, spacing, motion, useReduceMotion } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'danger' | 'errorContainer' | 'outline' | 'ghost';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  variant = 'primary', 
  style, 
  textStyle, 
  icon,
  onPressIn,
  onPressOut,
  ...rest 
}) => {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    if (!reduceMotion) {
      scale.value = withTiming(0.97, { 
        duration: motion.duration.fast, 
        easing: motion.easing.pressOut 
      });
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    if (!reduceMotion) {
      scale.value = withTiming(1, { 
        duration: motion.duration.fast, 
        easing: motion.easing.pressOut 
      });
    }
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          borderRadius: radius.button,
        },
        animatedStyle,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // Replaced activeOpacity={0.8} with native press feedback, but since we scale, opacity dip is not needed per material specs
      // If we want both, we can conditionally apply opacity in style via pressed state if needed
      {...rest}
    >
      {icon && React.cloneElement(icon as React.ReactElement<any>, { color: getTextColor() })}
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
    </AnimatedPressable>
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
