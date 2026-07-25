import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, motion, useReduceMotion } from '../theme';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, withTiming, interpolateColor } from 'react-native-reanimated';

import HomeStack from './HomeStack';
import ActivityStack from './ActivityStack';
import SettingsStack from './SettingsStack';

const Tab = createBottomTabNavigator();
const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

// Custom Animated Tab Icon
function TabIcon({ focused, name, activeName, size }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  
  const progress = useDerivedValue(() => {
    if (reduceMotion) return focused ? 1 : 0;
    return withTiming(focused ? 1 : 0, { 
      duration: motion.duration.fast, 
      easing: motion.easing.pressOut 
    });
  }, [focused, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.onSurfaceVariant, colors.primary])
  }));

  return <AnimatedIcon name={focused ? activeName : name} size={size} animatedProps={animatedProps} />;
}

// Custom Animated Tab Label
function TabLabel({ focused, label }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  
  const progress = useDerivedValue(() => {
    if (reduceMotion) return focused ? 1 : 0;
    return withTiming(focused ? 1 : 0, { 
      duration: motion.duration.fast, 
      easing: motion.easing.pressOut 
    });
  }, [focused, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.onSurfaceVariant, colors.primary])
  }));

  return <Animated.Text style={[{ fontSize: 11, fontWeight: '500' }, animatedStyle]}>{label}</Animated.Text>;
}

// Utility to hide the bottom tab bar on specific nested screens
function getTabBarStyle(route) {
  const routeName = getFocusedRouteNameFromRoute(route);
  
  // List of screens where the tab bar should be hidden
  const hiddenRoutes = [
    'Trip',
    'Map',
    'LiveTracking',
    'TripDetails',
    'EmergencyDetails',
  ];

  if (hiddenRoutes.includes(routeName)) {
    return { display: 'none' };
  }
  return {};
}

export default function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        unmountOnBlur: false,
        tabBarStyle: [
          {
            position: 'absolute', // Required so content scrolls underneath
            borderTopWidth: 0, // Removed hard 1px border
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.06, // Soft shadow
            shadowRadius: 3,
            height: 65,
            paddingBottom: 10,
            paddingTop: 8,
            // Fallback translucent background to avoid the native BlurView crash
            backgroundColor: colors.surface === '#1A2120' ? 'rgba(26,33,32,0.92)' : 'rgba(255,255,255,0.92)',
          },
          getTabBarStyle(route)
        ],
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeStack} 
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Home" />,
          tabBarIcon: ({ size, focused }) => (
            <TabIcon focused={focused} name="home-outline" activeName="home" size={size} />
          )
        }}
      />
      <Tab.Screen 
        name="ActivityTab" 
        component={ActivityStack} 
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Activity" />,
          tabBarIcon: ({ size, focused }) => (
            <TabIcon focused={focused} name="compass-outline" activeName="compass" size={size} />
          )
        }}
      />
      <Tab.Screen 
        name="SettingsTab" 
        component={SettingsStack} 
        options={{
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Settings" />,
          tabBarIcon: ({ size, focused }) => (
            <TabIcon focused={focused} name="settings-outline" activeName="settings" size={size} />
          )
        }}
      />
    </Tab.Navigator>
  );
}
