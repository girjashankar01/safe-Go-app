import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';

import HomeStack from './HomeStack';
import ActivityStack from './ActivityStack';
import SettingsStack from './SettingsStack';

const Tab = createBottomTabNavigator();

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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarShowLabel: true,
        unmountOnBlur: false, // Explicitly preserve state
        tabBarBackground: () => (
          <BlurView 
            tint={colors.background === '#000000' || colors.card === '#1c1c1e' ? "dark" : "light"} 
            intensity={80} 
            style={{ flex: 1 }} 
          />
        ),
        tabBarStyle: [
          {
            position: 'absolute', // Required so content scrolls underneath the blur
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.08)',
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            backgroundColor: colors.card === '#1c1c1e' ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.6)',
          },
          getTabBarStyle(route)
        ],
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeStack} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
          )
        }}
      />
      <Tab.Screen 
        name="ActivityTab" 
        component={ActivityStack} 
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} color={color} size={size} />
          )
        }}
      />
      <Tab.Screen 
        name="SettingsTab" 
        component={SettingsStack} 
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} color={color} size={size} />
          )
        }}
      />
    </Tab.Navigator>
  );
}
