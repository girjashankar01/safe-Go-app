import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LocationService from '../services/LocationService';
import * as Battery from 'expo-battery';
import { useTheme, spacing, typography } from '../theme';
import { Card } from './ui/Card';

export default function SystemStatusCard({ socketStatus }) {
  const { colors } = useTheme();
  const [locationStatus, setLocationStatus] = useState('Checking...');
  const [batteryLevel, setBatteryLevel] = useState(null);

  // Initial fetch and listener for Location
  useEffect(() => {
    let mounted = true;

    const checkLocation = async () => {
      try {
        const hasPerm = await LocationService.ensurePermission();
        if (!hasPerm) {
          if (mounted) setLocationStatus('Permission Required');
          return;
        }
        
        const servicesEnabled = await LocationService.hasServicesEnabled();
        if (mounted) setLocationStatus(servicesEnabled ? 'On' : 'Off');

        // Fetch current location to get a fresh timestamp on mount
        await LocationService.getCurrentLocation();
      } catch (e) {
        if (mounted) setLocationStatus('Error');
      }
    };

    checkLocation();

    return () => {
      mounted = false;
    };
  }, []);

  // Initial fetch and listener for Battery
  useEffect(() => {
    let mounted = true;
    let batterySub = null;

    const initBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (mounted) {
          setBatteryLevel(level !== -1 ? Math.round(level * 100) : 100);
        }

        batterySub = Battery.addBatteryLevelListener(({ batteryLevel: newLevel }) => {
          if (mounted) {
            setBatteryLevel(newLevel !== -1 ? Math.round(newLevel * 100) : 100);
          }
        });
      } catch (e) {
        console.warn('Failed to get battery level');
      }
    };

    initBattery();

    return () => {
      mounted = false;
      if (batterySub) batterySub.remove();
    };
  }, []);

  // Overall status logic
  const isSocketConnected = socketStatus === 'connected';
  const isLocationOn = locationStatus === 'On';
  const isBatteryCritical = batteryLevel !== null && batteryLevel < 10;
  const isBatteryLow = batteryLevel !== null && batteryLevel < 20;

  let overallStatus = 'ALL SYSTEMS ACTIVE';
  let overallColor = colors.success; // Muted Green

  if (isBatteryCritical || (!isSocketConnected && !isLocationOn)) {
    overallStatus = 'CRITICAL ISSUE';
    overallColor = colors.error; // Error Red
  } else if (!isSocketConnected || isBatteryLow || locationStatus === 'Permission Required' || locationStatus === 'Off') {
    overallStatus = 'SOME ISSUES';
    overallColor = '#f59e0b'; // Amber
  }

  // Battery formatting
  let batteryColor = colors.success;
  let batteryLabel = 'Good';
  if (batteryLevel !== null) {
    if (batteryLevel < 10) {
      batteryColor = '#991b1b'; // Dark Red (critical)
      batteryLabel = 'Critical';
    } else if (batteryLevel < 20) {
      batteryColor = colors.error; // Error
      batteryLabel = 'Low';
    } else if (batteryLevel < 50) {
      batteryColor = '#f59e0b'; // Orange
      batteryLabel = 'Medium';
    }
  }

  return (
    <Card style={styles.cardSpacing}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: overallColor }]} />
        <Text style={[styles.headerTitle, { color: overallColor }]}>{overallStatus}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      {/* Socket */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="wifi" size={20} color={colors.secondaryText} style={styles.icon} />
          <Text style={[styles.label, { color: colors.text }]}>Socket Connection</Text>
        </View>
        <Text style={[styles.value, { color: isSocketConnected ? colors.success : colors.error }]}>
          {isSocketConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* Location */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="map-pin" size={20} color={colors.secondaryText} style={styles.icon} />
          <Text style={[styles.label, { color: colors.text }]}>Location Services</Text>
        </View>
        <Text style={[styles.value, { color: isLocationOn ? colors.success : (locationStatus === 'Checking...' ? '#6b7280' : '#f59e0b') }]}>
          {locationStatus}
        </Text>
      </View>

      {/* Battery */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="battery" size={20} color={colors.secondaryText} style={styles.icon} />
          <Text style={[styles.label, { color: colors.text }]}>Battery</Text>
        </View>
        <Text style={[styles.value, { color: batteryColor }]}>
          {batteryLevel !== null ? `${batteryLevel}% • ${batteryLabel}` : 'Unknown'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardSpacing: {
    marginBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  headerTitle: {
    ...typography.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  label: {
    ...typography.body,
    color: '#374151',
  },
  value: {
    ...typography.body,
    fontWeight: '600',
  },
  valueNeutral: {
    ...typography.body,
    color: '#6b7280',
  },
});
