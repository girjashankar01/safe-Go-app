import React from 'react';
import { Text, StyleSheet, TouchableOpacityProps, View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, radius, typography, spacing, motion, useReduceMotion } from '../../theme';
import { Feather } from '@expo/vector-icons';

interface ActionCardProps extends TouchableOpacityProps {
  label: string;
  iconName: keyof typeof Feather.glyphMap;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ActionCard: React.FC<ActionCardProps> = ({ label, iconName, style, onPressIn, onPressOut, ...rest }) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

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
        styles.card,
        {
          backgroundColor: colors.surfaceVariant, // Judgment call
          borderRadius: radius.card,
          borderWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        animatedStyle,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
    </AnimatedPressable>
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
