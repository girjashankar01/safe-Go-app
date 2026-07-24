import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import EmergencyDirectoryService from '../services/EmergencyDirectoryService';
import SOSService from '../services/SOSService';
import { formatDistance } from '../utils/DistanceUtils';

export default function EmergencyServicesScreen({ navigation }) {
  const [state, setState] = useState(EmergencyDirectoryService.getState());
  const [numbers, setNumbers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [sosState, setSosState] = useState(SOSService.getState().status);

  useEffect(() => {
    // Subscribe to Directory state
    const unsubDir = EmergencyDirectoryService.subscribe((s) => {
      setState(s);
      setNumbers([...EmergencyDirectoryService.getCachedNumbers()]);
      setFacilities([...EmergencyDirectoryService.getCachedFacilities()]);
    });

    // Subscribe to SOS state for pinning shortcuts
    const unsubSos = SOSService.subscribe((s) => {
      setSosState(s.status);
    });

    // Make sure we trigger a refresh on screen focus
    EmergencyDirectoryService.refresh();

    return () => {
      unsubDir();
      unsubSos();
    };
  }, []);

  const handleCall = (number) => {
    Linking.openURL(`tel:${number}`);
  };

  const isSosActive = ['recording', 'uploading', 'sending', 'success'].includes(sosState);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Resources</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        
        {/* State Banner */}
        {state === 'Loading' && (
          <View style={[styles.banner, styles.bannerLoading]}>
            <ActivityIndicator size="small" color="#1d4ed8" style={{ marginRight: 8 }} />
            <Text style={styles.bannerText}>Loading resources...</Text>
          </View>
        )}
        {state === 'Refreshing' && (
          <View style={[styles.banner, styles.bannerLoading]}>
            <ActivityIndicator size="small" color="#1d4ed8" style={{ marginRight: 8 }} />
            <Text style={styles.bannerText}>Refreshing resources...</Text>
          </View>
        )}
        {state === 'Offline' && (
          <View style={[styles.banner, styles.bannerOffline]}>
            <Feather name="wifi-off" size={16} color="#b45309" style={{ marginRight: 8 }} />
            <Text style={[styles.bannerText, { color: '#b45309' }]}>Offline. Showing cached data.</Text>
          </View>
        )}
        {state === 'Error' && numbers.length === 0 && (
          <View style={[styles.banner, styles.bannerError]}>
            <Feather name="alert-triangle" size={16} color="#991b1b" style={{ marginRight: 8 }} />
            <Text style={[styles.bannerText, { color: '#991b1b' }]}>Failed to load resources.</Text>
          </View>
        )}

        {/* SOS Integration Shortcuts */}
        {isSosActive && (
          <View style={styles.section}>
            <View style={styles.sosWarning}>
              <Feather name="alert-circle" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={styles.sosWarningText}>SOS Active — Quick Actions</Text>
            </View>
            <View style={styles.sosActions}>
              <TouchableOpacity style={styles.sosBtn} onPress={() => handleCall('112')}>
                <Feather name="phone-call" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.sosBtnText}>Call Police</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sosBtn} onPress={() => handleCall('108')}>
                <Feather name="phone-call" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.sosBtnText}>Ambulance</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Emergency Numbers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Numbers</Text>
          {numbers.length === 0 && state !== 'Loading' && state !== 'Refreshing' && (
            <Text style={styles.emptyText}>No emergency numbers available.</Text>
          )}
          {numbers.map((item, idx) => (
            <View key={item.id || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="phone" size={18} color="#1d4ed8" style={{ marginRight: 10 }} />
                <Text style={styles.cardTitle}>{item.service_name || item.service_type}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardNumber}>{item.phone_number}</Text>
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(item.phone_number)}>
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              </View>
              {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            </View>
          ))}
        </View>

        {/* Nearby Facilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Facilities</Text>
          {facilities.length === 0 && (state === 'Ready' || state === 'Offline') && (
            <Text style={styles.emptyText}>No facilities found nearby.</Text>
          )}
          {facilities.map((item, idx) => (
            <View key={item.id || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather 
                  name={item.type === 'Hospital' ? 'activity' : item.type === 'Police Station' ? 'shield' : 'briefcase'} 
                  size={18} 
                  color="#1d4ed8" 
                  style={{ marginRight: 10 }} 
                />
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardDesc}>{item.type} • {formatDistance(item.distance)}</Text>
                <TouchableOpacity 
                  style={styles.outlineBtn} 
                  onPress={() => Linking.openURL(`maps://app?daddr=${item.lat},${item.lon}`)}
                >
                  <Text style={styles.outlineBtnText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  bannerLoading: {
    backgroundColor: '#eff6ff',
  },
  bannerOffline: {
    backgroundColor: '#fef3c7',
  },
  bannerError: {
    backgroundColor: '#fee2e2',
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1d4ed8',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  callBtn: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  callBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  outlineBtn: {
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  outlineBtnText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 14,
  },
  sosWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  sosWarningText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  sosActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sosBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  sosBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
