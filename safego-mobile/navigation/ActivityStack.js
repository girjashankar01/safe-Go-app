import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ActivityScreen from '../screens/ActivityScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EmergencyHistoryScreen from '../screens/EmergencyHistoryScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import EmergencyDetailsScreen from '../screens/EmergencyDetailsScreen';
import MapScreen from '../screens/MapScreen';
import LiveTrackingScreen from '../screens/LiveTrackingScreen';

const Stack = createNativeStackNavigator();

export default function ActivityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="EmergencyHistory" component={EmergencyHistoryScreen} />
      <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
      <Stack.Screen name="EmergencyDetails" component={EmergencyDetailsScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
    </Stack.Navigator>
  );
}
