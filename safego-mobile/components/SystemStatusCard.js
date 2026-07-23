import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

function getRelativeTime(timestampStr) {
  if (!timestampStr) return 'Unknown';
  const diffMs = Date.now() - new Date(timestampStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 5) return 'Now';
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} hr ago`;
}

export default function SystemStatusCard({ socketStatus }) {
  const [locationStatus, setLocationStatus] = useState('Checking...');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [relativeTime, setRelativeTime] = useState('Never');

  // Initial fetch and listener for Location
  useEffect(() => {
    let mounted = true;

    const checkLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) setLocationStatus('Permission Required');
          return;
        }
        
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (mounted) setLocationStatus(servicesEnabled ? 'On' : 'Off');

        // Fetch last known location as a fallback if no live trip is running
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && mounted) {
          const ts = lastKnown.timestamp ? new Date(lastKnown.timestamp).toISOString() : new Date().toISOString();
          setLastUpdate((prev) => prev || ts);
        }
      } catch (e) {
        if (mounted) setLocationStatus('Error');
      }
    };

    checkLocation();

    const sub = DeviceEventEmitter.addListener('LocationUpdated', (timestamp) => {
      setLastUpdate(timestamp);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Initial fetch and listener for Battery
  useEffect(() => {
    let mounted = true;
    let batterySub = null;

    const initBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (mounted && level !== -1) setBatteryLevel(Math.round(level * 100));

        batterySub = Battery.addBatteryLevelListener(({ batteryLevel: newLevel }) => {
          if (mounted && newLevel !== -1) setBatteryLevel(Math.round(newLevel * 100));
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

  // Ticker for relative time
  useEffect(() => {
    if (!lastUpdate) return;
    
    // Update immediately when lastUpdate changes
    setRelativeTime(getRelativeTime(lastUpdate));

    const interval = setInterval(() => {
      setRelativeTime(getRelativeTime(lastUpdate));
    }, 1000); // tick every second so "3 sec ago" updates correctly

    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Overall status logic
  const isSocketConnected = socketStatus === 'connected';
  const isLocationOn = locationStatus === 'On';
  const isBatteryCritical = batteryLevel !== null && batteryLevel < 10;
  const isBatteryLow = batteryLevel !== null && batteryLevel < 20;

  let overallStatus = 'ALL SYSTEMS ACTIVE';
  let overallColor = '#16a34a'; // Green

  if (isBatteryCritical || (!isSocketConnected && !isLocationOn)) {
    overallStatus = 'CRITICAL ISSUE';
    overallColor = '#dc2626'; // Red
  } else if (!isSocketConnected || isBatteryLow || locationStatus === 'Permission Required' || locationStatus === 'Off') {
    overallStatus = 'SOME ISSUES';
    overallColor = '#f59e0b'; // Amber
  }

  // Battery formatting
  let batteryColor = '#16a34a';
  let batteryLabel = 'Good';
  if (batteryLevel !== null) {
    if (batteryLevel < 10) {
      batteryColor = '#991b1b'; // Dark Red
      batteryLabel = 'Critical';
    } else if (batteryLevel < 20) {
      batteryColor = '#dc2626'; // Red
      batteryLabel = 'Low';
    } else if (batteryLevel < 50) {
      batteryColor = '#f59e0b'; // Orange
      batteryLabel = 'Medium';
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: overallColor }]} />
        <Text style={[styles.headerTitle, { color: overallColor }]}>{overallStatus}</Text>
      </View>

      <View style={styles.divider} />

      {/* Socket */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="wifi" size={20} color="#6b7280" style={styles.icon} />
          <Text style={styles.label}>Socket Connection</Text>
        </View>
        <Text style={[styles.value, { color: isSocketConnected ? '#16a34a' : '#dc2626' }]}>
          {isSocketConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* Location */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="map-pin" size={20} color="#6b7280" style={styles.icon} />
          <Text style={styles.label}>Location Services</Text>
        </View>
        <Text style={[styles.value, { color: isLocationOn ? '#16a34a' : '#dc2626' }]}>
          {locationStatus}
        </Text>
      </View>

      {/* Battery */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="battery" size={20} color="#6b7280" style={styles.icon} />
          <Text style={styles.label}>Battery</Text>
        </View>
        <Text style={[styles.value, { color: batteryColor }]}>
          {batteryLevel !== null ? `${batteryLevel}% • ${batteryLabel}` : 'Unknown'}
        </Text>
      </View>

      {/* Last Update */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Feather name="clock" size={20} color="#6b7280" style={styles.icon} />
          <Text style={styles.label}>Last Update</Text>
        </View>
        <Text style={styles.valueNeutral}>
          {relativeTime}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  valueNeutral: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});
