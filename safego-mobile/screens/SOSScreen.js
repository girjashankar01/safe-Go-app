import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { triggerSOS, getActiveTrip } from '../lib/api';
import { getTrip, hasActiveTrip, clearTrip, setTrip } from '../lib/tripState';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SOSScreen({ navigation }) {
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [working, setWorking] = useState(false);

  // ── Get latest location (best-effort, never blocks SOS) ───────────────────
  const getLatestLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return { latitude: null, longitude: null };

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
    } catch {
      // Location unavailable — still allow SOS with null coordinates.
      return { latitude: null, longitude: null };
    }
  };

  const handlePress = () => {
    if (working) return;

    if (!hasActiveTrip()) {
      setErrorMsg('Start a trip before sending an SOS.');
      setSent(false);
      return;
    }

    // Reset any previous result first so the user can re-send.
    setSent(false);
    setErrorMsg('');

    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to send an emergency alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: sendSOS,
        },
      ],
    );
  };

  const sendSOS = async () => {
    if (working) return;
    setWorking(true);
    setSent(false);
    setErrorMsg('');

    const trip = getTrip();
    if (!trip || !trip.tripId) {
      setErrorMsg('Start a trip before sending an SOS.');
      setWorking(false);
      return;
    }

    try {
      const { latitude, longitude } = await getLatestLocation();

      const payload = {
        tripId: trip.tripId,
        lat: latitude,
        lng: longitude,
        triggerType: 'manual',
      };

      console.log('[SOS] Sending SOS...');
      await triggerSOS(payload);
      console.log(`[SOS] Response received tripId=${trip.tripId} status=success`);

      setSent(true);
      setErrorMsg('');
    } catch (e) {
      const status = e.response?.status;
      const serverMsg = e.response?.data?.error || '';

      if (status === 401) {
        setErrorMsg('Please log in again.');
      } else if (status === 404) {
        setErrorMsg('Trip not found. Refreshing status...');
        try {
          const result = await getActiveTrip();
          if (result.hasActiveTrip) {
            const currentTrip = getTrip();
            await setTrip({
              tripId: result.trip.id,
              trackingToken: result.trip.trackingToken,
              startedAt: result.trip.startedAt,
              userId: currentTrip.userId,
            });
            setErrorMsg('Trip state refreshed. Please try again.');
          } else {
            await clearTrip();
            setErrorMsg('Trip already ended. Start a trip before sending an SOS.');
          }
        } catch (refreshErr) {
          setErrorMsg('Trip not found. Unable to refresh status.');
        }
      } else if (status === 409) {
        setErrorMsg(serverMsg || 'Conflict updating SOS.');
      } else if (status >= 500) {
        setErrorMsg('Server error.\n\nPlease try again.');
      } else if (!status) {
        setErrorMsg('Unable to contact server.');
      } else {
        setErrorMsg(serverMsg || 'Failed to trigger SOS.');
      }
      setSent(false);
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency SOS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning card */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>Emergency SOS</Text>
          <Text style={styles.warningBody}>
            Pressing this button will immediately send an emergency signal.
          </Text>
        </View>

        {/* Success banner */}
        {sent && !errorMsg ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>SOS sent successfully.{'\n\n'}Your emergency contacts have been notified.</Text>
          </View>
        ) : null}

        {/* Error banner */}
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* SOS button */}
        <TouchableOpacity
          style={[styles.sosBtn, working && styles.sosBtnDisabled]}
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={working}
        >
          {working ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sosBtnText}>SEND SOS</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          A confirmation will appear before the signal is sent.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15,
    color: '#16a34a',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 60,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },

  // Warning card
  warningCard: {
    width: '100%',
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#fecdd3',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  warningIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#be123c',
    marginBottom: 10,
    textAlign: 'center',
  },
  warningBody: {
    fontSize: 15,
    color: '#9f1239',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Success banner
  successBanner: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  successText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
    textAlign: 'center',
  },

  // Error banner
  errorBanner: {
    width: '100%',
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecdd3',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#be123c',
    textAlign: 'center',
    lineHeight: 20,
  },

  // SOS button
  sosBtn: {
    width: '100%',
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#dc2626',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sosBtnDisabled: {
    opacity: 0.6,
  },
  sosBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Disclaimer
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 17,
  },
});

