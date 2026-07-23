import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { triggerSOS, getActiveTrip, uploadSOSAudio } from '../lib/api';
import { getTrip, hasActiveTrip, clearTrip, setTrip } from '../lib/tripState';
import { getSettings } from '../services/SettingsService';
import { recordAudio } from '../services/AudioService';
import PinService from '../services/PinService';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SOSScreen({ navigation }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const [sosState, setSosState] = useState('idle'); // 'idle' | 'countdown' | 'recording' | 'uploading' | 'sending' | 'success' | 'cooldown'
  const [countdown, setCountdown] = useState(5);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(0);
  const [settings, setSettings] = useState(null);

  // Load settings on mount
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const overlayFade = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.9)).current;
  const numberScale = React.useRef(new Animated.Value(1)).current;

  // Animate overlay in
  useEffect(() => {
    if (sosState !== 'idle' && sosState !== 'success' && sosState !== 'cooldown') {
      overlayFade.setValue(0);
      cardScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(overlayFade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [sosState]);

  // Animate number change
  useEffect(() => {
    if (sosState === 'countdown') {
      numberScale.setValue(0.7);
      Animated.timing(numberScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [countdown, sosState]);

  useEffect(() => {
    let timer;
    const initialCountdown = settings?.sosCountdown ?? 5;
    
    if (sosState === 'countdown' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (sosState === 'countdown' && countdown === 0) {
      setSosState('idle'); // We transition inside sendSOS
      setCountdown(initialCountdown); // Reset for next time
      sendSOS();
    }
    return () => clearTimeout(timer);
  }, [sosState, countdown, settings]);

  useEffect(() => {
    let timer;
    if (sosState === 'recording' && recordingTimeLeft > 0) {
      timer = setTimeout(() => {
        setRecordingTimeLeft((c) => c - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [sosState, recordingTimeLeft]);

  useEffect(() => {
    let timer;
    if (sosState === 'cooldown' && cooldownRemaining > 0) {
      timer = setTimeout(() => {
        setCooldownRemaining((c) => c - 1);
      }, 1000);
    } else if (sosState === 'cooldown' && cooldownRemaining === 0) {
      setSosState('idle');
    }
    return () => clearTimeout(timer);
  }, [sosState, cooldownRemaining]);

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
    if (sosState !== 'idle') return;

    if (!hasActiveTrip()) {
      setErrorMsg('Start a trip before sending an SOS.');
      return;
    }

    setErrorMsg('');
    
    const configuredCountdown = settings?.sosCountdown ?? 5;
    if (configuredCountdown > 0) {
      setCountdown(configuredCountdown);
      setSosState('countdown');
    } else {
      // Instant SOS
      sendSOS();
    }
  };

  const sendSOS = async () => {
    if (sosState === 'sending' || sosState === 'recording' || sosState === 'uploading') return;
    setErrorMsg('');

    const trip = getTrip();
    if (!trip || !trip.tripId) {
      setErrorMsg('Start a trip before sending an SOS.');
      setSosState('idle');
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

      if (settings?.recordAudio) {
        setSosState('recording');
        console.log('[SOS] Recording...');
        const durationSeconds = settings.audioRecordingDuration ?? 15;
        setRecordingTimeLeft(durationSeconds);
        
        const localUri = await recordAudio({ 
          durationSeconds,
          onRecordingComplete: () => setSosState('uploading') 
        });

        if (localUri) {
          try {
            console.log('[SOS] Uploading to backend...');
            const formData = new FormData();
            formData.append('audio', {
              uri: localUri,
              name: 'sos.m4a',
              type: 'audio/m4a',
            });
            formData.append('tripId', trip.tripId);
            
            const uploadRes = await uploadSOSAudio(formData);
            if (uploadRes && uploadRes.success && uploadRes.publicUrl) {
              console.log('[SOS] Backend upload complete');
              payload.audioClipUrl = uploadRes.publicUrl;
            } else {
              console.warn('[SOS] Backend upload failed or returned no public URL');
            }
          } catch (uploadError) {
            console.error('[SOS] Backend upload failed:', uploadError.message);
          }
        }
      }

      setSosState('sending');
      console.log('[SOS] Triggering SOS...');
      await triggerSOS(payload);
      console.log(`[SOS] Response received tripId=${trip.tripId} status=success`);

      setSosState('success');
      setErrorMsg('');
      setTimeout(() => {
        setCooldownRemaining(settings?.sosCooldown ?? 60);
        setSosState('cooldown');
      }, 2000);
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
      setSosState('idle');
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
        {(sosState === 'success' || sosState === 'cooldown') && !errorMsg ? (
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
          style={[styles.sosBtn, ((sosState === 'recording' || sosState === 'uploading' || sosState === 'sending') || cooldownRemaining > 0) && styles.sosBtnDisabled]}
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={sosState !== 'idle' || cooldownRemaining > 0}
        >
          {(sosState === 'recording' || sosState === 'uploading' || sosState === 'sending') ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sosBtnText}>
              {cooldownRemaining > 0 ? `WAIT ${cooldownRemaining}s` : 'SEND SOS'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          A confirmation will appear before the signal is sent.
        </Text>
      </ScrollView>

      {/* Countdown Overlay */}
      {sosState === 'countdown' || sosState === 'recording' || sosState === 'uploading' || sosState === 'sending' || sosState === 'success' ? (
        <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
          <Animated.View style={[styles.countdownCard, { transform: [{ scale: cardScale }] }]}>
            <Text style={styles.overlayWarning}>
              {sosState === 'success' ? '✅' : '⚠️'}
            </Text>
            <Text style={styles.overlayTitle}>
              {sosState === 'success' ? 'SOS Sent ✓' : 'Emergency SOS'}
            </Text>
            <Text style={styles.overlaySubtitle}>
              {sosState === 'countdown' ? 'Sending emergency alert in' : 
               sosState === 'recording' ? 'Recording Audio...' : 
               sosState === 'uploading' ? 'Uploading Audio...' : 
               sosState === 'sending' ? 'Sending SOS...' : ''}
            </Text>
            
            {sosState === 'countdown' && (
              <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: numberScale }] }]}>
                {countdown}
              </Animated.Text>
            )}

            {sosState === 'recording' && (
              <Text style={styles.countdownNumber}>{recordingTimeLeft}</Text>
            )}

            {(sosState === 'uploading' || sosState === 'sending') && (
              <ActivityIndicator size="large" color="#dc2626" style={{ marginVertical: 20 }} />
            )}
            
            {sosState === 'countdown' && (
              <>
                <Text style={styles.overlayDisclaimer}>
                  Emergency contacts will be notified{'\n'}unless you cancel.
                </Text>
                
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={async () => {
                    // Temporarily block UI interaction while Pin modal is shown
                    const validated = await PinService.requestPinValidation();
                    if (validated) {
                      setSosState('idle');
                      setCountdown(settings?.sosCountdown ?? 5);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>Cancel SOS</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </Animated.View>
      ) : null}

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

  // Countdown Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    paddingHorizontal: 24,
  },
  countdownCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  overlayWarning: {
    fontSize: 48,
    marginBottom: 12,
  },
  overlayTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  overlaySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#dc2626',
    marginBottom: 24,
    textAlign: 'center',
  },
  overlayDisclaimer: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  cancelBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cancelBtnText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
});

