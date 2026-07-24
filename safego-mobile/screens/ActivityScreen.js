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
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import * as Location from 'expo-location';

import LocationService from '../services/LocationService';
import EmergencyHistoryService from '../services/EmergencyHistoryService';
import { getTrips } from '../lib/api';

import { ScreenContainer } from '../components/ui/ScreenContainer';
import { Card } from '../components/ui/Card';
import { useTheme, typography, spacing, radius } from '../theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DELTA = 0.01;

function formatTimestamp(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
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
  if (!startIso) return '';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diff = end - start;
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

            // Fetch address directly using Expo Location to avoid undefined methods
            if (!address || address === 'Locating...') {
              Location.reverseGeocodeAsync({ latitude: loc.latitude, longitude: loc.longitude })
                .then((geocodeResult) => {
                  if (mounted && geocodeResult && geocodeResult.length > 0) {
                    const primary = geocodeResult[0];
                    const name = [primary.city || primary.subregion, primary.region, primary.isoCountryCode || primary.country]
                      .filter(Boolean)
                      .join(', ');
                    setAddress(name || 'Location acquired');
                  }
                })
                .catch(() => {
                  if (mounted) setAddress('Location acquired');
                });
            }

            // Manage Map Centering (prevent jitter) using animateCamera
            if (!lastMapCenter.current) {
              // Initial center
              lastMapCenter.current = { latitude: loc.latitude, longitude: loc.longitude };
              mapRef.current?.animateCamera({
                center: { latitude: loc.latitude, longitude: loc.longitude }
              }, { duration: 1000 });
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
  }, []);


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
          
          {/* 1. Embedded Map (220dp height) - FULL BLEED EDGE TO EDGE */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Map')}>
            <View style={styles.mapCard}>
              <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
                <MapView
                  ref={mapRef}
                  style={styles.mapView}
                  initialRegion={{
                    latitude: 37.78825,
                    longitude: -122.4324,
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
                  toolbarEnabled={false}
                >
                  {coords && <Marker coordinate={coords} pinColor={colors.primary} />}
                </MapView>
                
                {!coords && (
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e5e7eb' }]}>
                    <Text style={{ color: colors.secondaryText }}>Loading map...</Text>
                  </View>
                )}

                {/* Seamless bottom fade using SVG */}
                <View style={styles.mapGradient}>
                  <Svg height="100%" width="100%">
                    <Defs>
                      <SvgLinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
                        <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
                  </Svg>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* 2. Current Location Tracking (160dp height) */}
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('LiveTracking')}>
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
                <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={1}>
                  {!coords ? 'Locating...' : address}
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
                    Updated: {lastUpdated ? formatTimestamp(new Date(lastUpdated).toISOString()) : '--'}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>

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
                <TouchableOpacity 
                  style={styles.historyRow}
                  onPress={() => navigation.navigate('EmergencyDetails', { incidentId: historyItems[0].id })}
                >
                  <View>
                    <Text style={[styles.historyItemType, { color: colors.text }]}>
                      {historyItems[0].display_type}
                    </Text>
                    <Text style={[styles.historyItemDate, { color: colors.secondaryText }]}>
                      {formatDate(historyItems[0].fired_at)} • {formatTimestamp(historyItems[0].fired_at)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
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
                <TouchableOpacity 
                  style={styles.historyRow}
                  onPress={() => navigation.navigate('TripDetails', { tripId: latestTrip.id })}
                >
                  <View>
                    <Text style={[styles.historyItemType, { color: colors.text }]}>
                      {latestTrip.status === 'active' ? 'Trip Active' : 'Completed Trip'}
                    </Text>
                    <Text style={[styles.historyItemDate, { color: colors.secondaryText }]}>
                      Started {formatTimestamp(latestTrip.startedAt)} • {latestTrip.endedAt ? computeDuration(latestTrip.startedAt, latestTrip.endedAt) : 'In progress'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={24} color={colors.secondaryText} />
                </TouchableOpacity>
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
    paddingVertical: spacing.sm, // Reduced spacing
  },
  headerTitle: {
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md, // Tighter horizontal padding
    paddingBottom: spacing.xxxl,
  },
  
  // Map
  mapCard: {
    height: 220,
    marginBottom: spacing.md,
    // Negative margin to push it edge-to-edge over the ScrollView's padding
    marginHorizontal: -spacing.md,
  },
  trackingCard: {
    height: 160,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  historyCard: {
    height: 120,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  mapView: {
    width: '100%',
    height: 220,
    backgroundColor: '#e5e7eb',
  },
  mapGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Card Internals
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm, // Tighter
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
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
