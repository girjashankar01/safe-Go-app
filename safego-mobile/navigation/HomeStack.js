import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import EmergencyServicesScreen from '../screens/EmergencyServicesScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="EmergencyServices" component={EmergencyServicesScreen} />
    </Stack.Navigator>
  );
}
