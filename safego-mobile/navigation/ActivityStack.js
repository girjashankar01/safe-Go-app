import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ActivityScreen from '../screens/ActivityScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EmergencyHistoryScreen from '../screens/EmergencyHistoryScreen';

const Stack = createNativeStackNavigator();

export default function ActivityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="EmergencyHistory" component={EmergencyHistoryScreen} />
    </Stack.Navigator>
  );
}
