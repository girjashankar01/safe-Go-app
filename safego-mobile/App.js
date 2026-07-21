import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import EmergencyContactsScreen from './screens/EmergencyContactsScreen';
import CurrentLocationScreen from './screens/CurrentLocationScreen';
import LiveTrackingScreen from './screens/LiveTrackingScreen';
import SOSScreen from './screens/SOSScreen';
import MapScreen from './screens/MapScreen';
import TripScreen from './screens/TripScreen';
import HistoryScreen from './screens/HistoryScreen';
import TripDetailsScreen from './screens/TripDetailsScreen';
import SettingsScreen from './screens/SettingsScreen';

import { getToken, removeToken } from './services/storage';
import { getMe, setUnauthenticatedHandler } from './lib/api';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null); // null = still loading
  const navigationRef = useRef(null);

  // Register the global 401 handler once the navigation ref is ready.
  // This lets the Axios interceptor in api.js navigate to Login without
  // importing the navigator directly (avoids circular dependency).
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, []);

  // Auto-login: read stored token → validate with /auth/me → route accordingly.
  useEffect(() => {
    const bootstrap = async () => {
      const token = await getToken();

      if (!token) {
        setInitialRoute('Login');
        return;
      }

      try {
        await getMe(); // throws if token is invalid or expired
        setInitialRoute('Home');
      } catch {
        await removeToken();
        setInitialRoute('Login');
      }
    };

    bootstrap();
  }, []);

  if (!initialRoute) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
        <Stack.Screen name="CurrentLocation" component={CurrentLocationScreen} />
        <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
        <Stack.Screen name="SOS" component={SOSScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="Trip" component={TripScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
