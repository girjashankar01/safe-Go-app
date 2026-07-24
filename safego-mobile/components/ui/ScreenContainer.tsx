import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { useTheme, spacing } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  scrollable?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ 
  children, 
  style, 
  scrollable = false 
}) => {
  const { colors } = useTheme();

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    style,
  ];

  if (scrollable) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={containerStyle}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <SafeAreaView style={containerStyle}>
        {children}
      </SafeAreaView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxxl * 2, // Extra padding for bottom nav if needed
  }
});
