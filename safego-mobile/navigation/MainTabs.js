import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Home, Compass, Settings } from 'lucide-react-native';
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
        tabBarStyle: [
          {
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            backgroundColor: colors.card,
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
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="ActivityTab" 
        component={ActivityStack} 
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="SettingsTab" 
        component={SettingsStack} 
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}
