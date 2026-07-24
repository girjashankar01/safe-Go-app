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
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import FakeCallScreen from './screens/FakeCallScreen';
import EmergencyAlarmSettingsScreen from './screens/EmergencyAlarmSettingsScreen';
import EmergencyServicesScreen from './screens/EmergencyServicesScreen';
import EmergencyHistoryScreen from './screens/EmergencyHistoryScreen';
import EmergencyDetailsScreen from './screens/EmergencyDetailsScreen';

import { setUnauthenticatedHandler } from './lib/api';
import BootstrapService from './services/BootstrapService';
import { SafetyIdentityProvider } from './components/SafetyIdentityContext';

import CheckInModal from './components/CheckInModal';
import PinModal from './components/PinModal';
import FakeCallModal from './components/FakeCallModal';
import EmergencyAlarmModal from './components/EmergencyAlarmModal';

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

  // Bootstrap app state.
  useEffect(() => {
    const runBootstrap = async () => {
      const { route } = await BootstrapService.initialize();
      setInitialRoute(route);
    };
    runBootstrap();
  }, []);

  if (!initialRoute) {
    return <LoadingScreen />;
  }

  return (
    <SafetyIdentityProvider>
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
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="FakeCall" component={FakeCallScreen} />
        <Stack.Screen name="EmergencyAlarmSettings" component={EmergencyAlarmSettingsScreen} />
        <Stack.Screen name="EmergencyServices" component={EmergencyServicesScreen} />
        <Stack.Screen name="EmergencyHistory" component={EmergencyHistoryScreen} />
        <Stack.Screen name="EmergencyDetails" component={EmergencyDetailsScreen} />
      </Stack.Navigator>
      <CheckInModal />
      <PinModal />
      <FakeCallModal />
      <EmergencyAlarmModal />
    </NavigationContainer>
    </SafetyIdentityProvider>
  );
}
