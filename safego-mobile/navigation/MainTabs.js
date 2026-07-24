import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
        tabBarActiveTintColor: '#4F46E5', // Indigo interactive accent
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
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
            backgroundColor: colors.card === '#1c1c1e' ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
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
