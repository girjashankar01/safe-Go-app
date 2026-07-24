import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import EmergencyServicesScreen from '../screens/EmergencyServicesScreen';
import TripScreen from '../screens/TripScreen';
import CurrentLocationScreen from '../screens/CurrentLocationScreen';
import FakeCallScreen from '../screens/FakeCallScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="EmergencyServices" component={EmergencyServicesScreen} />
      <Stack.Screen name="Trip" component={TripScreen} />
      <Stack.Screen name="CurrentLocation" component={CurrentLocationScreen} />
      <Stack.Screen name="FakeCall" component={FakeCallScreen} />
    </Stack.Navigator>
  );
}
