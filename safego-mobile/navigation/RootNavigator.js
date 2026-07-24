import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainTabs from './MainTabs';

// Global Overlay Modals
import CheckInModal from '../components/CheckInModal';
import PinModal from '../components/PinModal';
import FakeCallModal from '../components/FakeCallModal';
import EmergencyAlarmModal from '../components/EmergencyAlarmModal';
import EmergencyOverlay from '../components/EmergencyOverlay';

const Stack = createNativeStackNavigator();

export default function RootNavigator({ initialRoute }) {
  // If initialRoute is one of the authenticated screens, we route to MainTabs instead.
  // The MainTabs will handle its own initial route (Home).
  // If we need to preserve exactly where it starts, we can handle it, 
  // but normally if authenticated, initial is 'Home' which maps to 'MainTabs'.
  const effectiveInitialRoute = (initialRoute === 'Login' || initialRoute === 'Register') 
    ? initialRoute 
    : 'MainTabs';

  return (
    <>
      <Stack.Navigator
        initialRouteName={effectiveInitialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'fade', // Subtle fade as requested
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>

      {/* Global Modals (rendered outside navigation flow but inside provider context) */}
      <CheckInModal />
      <FakeCallModal />
      <EmergencyAlarmModal />
      <EmergencyOverlay />
      <PinModal />
    </>
  );
}
