import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SettingsScreen from '../screens/SettingsScreen';
import EmergencyAlarmSettingsScreen from '../screens/EmergencyAlarmSettingsScreen';

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EmergencyAlarmSettings" component={EmergencyAlarmSettingsScreen} />
    </Stack.Navigator>
  );
}
