import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import LocationService from '../services/LocationService';
import EmergencyHistoryService from '../services/EmergencyHistoryService';
import { getTrips } from '../lib/api';

import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Card } from '../components/ui/Card';
import { useTheme, typography, spacing, radius } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DELTA = 0.01;

function formatTimestamp(epochMs) {
  if (!epochMs) return '--';
  const d = new Date(epochMs);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function computeDuration(startIso, endIso) {
  if (!startIso || !endIso) return '';
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} hr ${mins} min`;
}

// Distance calculation for meaningful map movement (prevent jitter)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of earth in m
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActivityScreen({ navigation }) {
  const { colors, isDark } = useTheme();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mapOpacity = useRef(new Animated.Value(0)).current;

  // States
  const [coords, setCoords] = useState(null); // Current device coordinates
  const [address, setAddress] = useState('Locating...');
  const [speed, setSpeed] = useState(0);
  const [motion, setMotion] = useState('Stationary');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  const [historyItems, setHistoryItems] = useState([]);
  const [latestTrip, setLatestTrip] = useState(null);

  // Map Refs
  const mapRef = useRef(null);
  const lastMapCenter = useRef(null);

  // ─── 1. Load Data ────────────────────────────────────────────────────────
  useEffect(() => {
    // Fade in cards
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Emergency History Subscription
    const unsubHistory = EmergencyHistoryService.subscribe(() => {
      setHistoryItems(EmergencyHistoryService.getCachedHistory());
    });
    setHistoryItems(EmergencyHistoryService.getCachedHistory());

    return () => unsubHistory();
  }, [fadeAnim]);

  // Refetch trips when screen focuses
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const fetchRecentTrip = async () => {
        try {
          const trips = await getTrips();
          if (active && trips && trips.length > 0) {
            setLatestTrip(trips[0]);
          }
        } catch (e) {
          console.log('Failed to fetch trips for Activity dashboard');
        }
      };
      fetchRecentTrip();
      return () => {
        active = false;
      };
    }, [])
  );

  // ─── 2. Location Tracking ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    const trackLocation = async () => {
      if (!mounted) return;
      try {
        const hasPerm = await LocationService.ensurePermission();
        if (hasPerm) {
          const loc = await LocationService.getCurrentLocation();
          if (mounted && loc) {
            setCoords({ latitude: loc.latitude, longitude: loc.longitude });
            setSpeed((loc.speed || 0) * 3.6); // m/s to km/h
            setMotion((loc.speed || 0) > 0.5 ? 'Moving' : 'Stationary');
            setLastUpdated(Date.now());
            setAccuracy(loc.accuracy || null);

            // Fetch address if missing (basic fallback, actual tracking might use reverseGeocodeAsync)
            const addr = await LocationService.getReadableAddress(loc.latitude, loc.longitude);
            if (mounted && addr) setAddress(addr);

            // Manage Map Centering (prevent jitter)
            if (!lastMapCenter.current) {
              // Initial center
              lastMapCenter.current = { latitude: loc.latitude, longitude: loc.longitude };
              mapRef.current?.animateToRegion({
                latitude: loc.latitude,
                longitude: loc.longitude,
                latitudeDelta: DELTA,
                longitudeDelta: DELTA,
              }, 400);
              // Cross-fade map in
              Animated.timing(mapOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }).start();
            } else {
              // Only recenter if moved more than 20 meters
              const dist = getDistanceFromLatLonInMeters(
                lastMapCenter.current.latitude,
                lastMapCenter.current.longitude,
                loc.latitude,
                loc.longitude
              );
              if (dist > 20) {
                lastMapCenter.current = { latitude: loc.latitude, longitude: loc.longitude };
                mapRef.current?.animateCamera({
                  center: { latitude: loc.latitude, longitude: loc.longitude }
                }, { duration: 1000 });
              }
            }
          }
        }
      } catch (e) {
        console.log('Activity tracking error', e);
      }
      
      if (mounted) {
        timeoutId = setTimeout(trackLocation, 3000);
      }
    };

    trackLocation();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [mapOpacity]);


  // ─── Renderers ───────────────────────────────────────────────────────────

  return (
    <ScreenContainer scrollable={false} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activity Dashboard</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          
          {/* 1. Embedded Map (220dp height) */}
          <Card style={styles.mapCard}>
            <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={() => navigation.navigate('Map')}
              style={styles.mapTouchContainer}
            >
              <Animated.View style={[styles.mapWrapper, { opacity: mapOpacity }]}>
                {coords && (
                  <MapView
                    ref={mapRef}
                    style={styles.mapView}
                    initialRegion={{
                      latitude: coords.latitude,
                      longitude: coords.longitude,
                      latitudeDelta: DELTA,
                      longitudeDelta: DELTA,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={false}
                  />
                )}
                {/* Subtle bottom fade */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)']}
                  style={styles.mapGradient}
                />
              </Animated.View>
              <View style={styles.mapOverlayText}>
                <Text style={styles.mapOverlayTitle}>Live Map</Text>
                <Feather name="maximize-2" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
          </Card>

          {/* 2. Current Location Tracking (160dp height) */}
          <Card style={styles.trackingCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Current Location</Text>
              {motion === 'Moving' ? (
                <Feather name="navigation" size={20} color={colors.primary} />
              ) : (
                <Feather name="map-pin" size={20} color={colors.secondaryText} />
              )}
            </View>
            
            <View style={styles.trackingBody}>
              <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                {address}
              </Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Speed</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{Math.round(speed)} km/h</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Motion</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>{motion}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Accuracy</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {accuracy ? `±${Math.round(accuracy)}m` : '--'}
                  </Text>
                </View>
              </View>

              <View style={styles.trackingFooter}>
                <Text style={[styles.coordText, { color: colors.secondaryText }]}>
                  {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : '--'}
                </Text>
                <Text style={[styles.updatedText, { color: colors.secondaryText }]}>
                  Updated: {formatTimestamp(lastUpdated)}
                </Text>
              </View>
            </View>
          </Card>

          {/* 3. Emergency History (120dp height) */}
          <Card style={styles.historyCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Emergency History</Text>
              <TouchableOpacity onPress={() => navigation.navigate('EmergencyHistory')}>
                <Text style={[styles.viewAllBtn, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.historyBody}>
              {historyItems.length > 0 ? (
                <View style={styles.historyRow}>
                  <View>
                    <Text style={[styles.historyItemType, { color: colors.text }]}>
                      {historyItems[0].display_type}
                    </Text>
                    <Text style={[styles.historyItemDate, { color: colors.secondaryText }]}>
                      {formatDate(historyItems[0].fired_at)} • {formatTimestamp(new Date(historyItems[0].fired_at).getTime())}
                    </Text>
                  </View>
                  <Feather name="alert-triangle" size={24} color={colors.danger} />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No emergency events yet.</Text>
                </View>
              )}
            </View>
          </Card>

          {/* 4. Trip History (120dp height) */}
          <Card style={styles.historyCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Trip History</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={[styles.viewAllBtn, { color: colors.primary }]}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.historyBody}>
              {latestTrip ? (
                <View style={styles.historyRow}>
                  <View>
                    <Text style={[styles.historyItemType, { color: colors.text }]}>
                      {latestTrip.status === 'active' ? 'Trip Active' : 'Completed Trip'}
                    </Text>
                    <Text style={[styles.historyItemDate, { color: colors.secondaryText }]}>
                      {formatDate(latestTrip.startedAt)} • {latestTrip.endedAt ? computeDuration(latestTrip.startedAt, latestTrip.endedAt) : 'In progress'}
                    </Text>
                  </View>
                  <Feather name="map" size={24} color={colors.primary} />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No trips yet.</Text>
                </View>
              )}
            </View>
          </Card>

        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  
  // Card base heights per spec
  mapCard: {
    height: 220,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    padding: 0, // Maps take full width
  },
  trackingCard: {
    height: 160,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  historyCard: {
    height: 120,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },

  // Map
  mapTouchContainer: {
    flex: 1,
    position: 'relative',
  },
  mapWrapper: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  mapView: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  mapOverlayText: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOverlayTitle: {
    color: '#FFF',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.body,
    marginRight: spacing.xs,
  },

  // Card Internals
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.bold,
  },
  viewAllBtn: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.semibold,
  },

  // Tracking details
  trackingBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  addressText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: typography.sizes.small,
    fontWeight: typography.weights.medium,
  },
  statValue: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  trackingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.3)',
    paddingTop: spacing.xs,
  },
  coordText: {
    fontSize: typography.sizes.small,
  },
  updatedText: {
    fontSize: typography.sizes.small,
  },

  // History details
  historyBody: {
    flex: 1,
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemType: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: typography.sizes.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body,
  }
});
