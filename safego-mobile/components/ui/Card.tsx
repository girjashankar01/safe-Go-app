import React, { useEffect, useRef } from 'react';
import { ViewStyle, StyleSheet, ViewProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme, radius, spacing, getElevation, motion, useReduceMotion } from '../../theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, noPadding = false, ...rest }) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReduceMotion();
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      opacity.value = withTiming(1, { 
        duration: motion.duration.normal, 
        easing: motion.easing.entrance 
      });
      translateY.value = withTiming(0, { 
        duration: motion.duration.normal, 
        easing: motion.easing.entrance 
      });
    }
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          padding: noPadding ? 0 : spacing.lg,
        },
        getElevation(isDark),
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
  },
});
