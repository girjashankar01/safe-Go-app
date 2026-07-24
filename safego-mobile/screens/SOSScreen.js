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
import { Feather } from '@expo/vector-icons';
import SOSService from '../services/SOSService';
import PinService from '../services/PinService';
import { useTheme } from '../theme';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SOSScreen({ navigation }) {
  const { colors } = useTheme();
  const [sosState, setSosState] = useState({
    status: 'idle',
    countdown: 0,
    recordingTimeLeft: 0,
    cooldownRemaining: 0,
    errorMsg: '',
  });

  const [isCountdownPaused, setIsCountdownPaused] = useState(false);

  useEffect(() => {
    const unsub = SOSService.subscribe(setSosState);
    return unsub;
  }, []);

  const { status, countdown, recordingTimeLeft, cooldownRemaining, errorMsg } = sosState;

  const overlayFade = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.9)).current;
  const numberScale = React.useRef(new Animated.Value(1)).current;

  // Animate overlay in
  useEffect(() => {
    if (status !== 'idle' && status !== 'success' && status !== 'cooldown' && status !== 'error') {
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
  }, [status]);

  // Animate number change
  useEffect(() => {
    if (status === 'countdown') {
      numberScale.setValue(0.7);
      Animated.timing(numberScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [countdown, status]);

  const handlePress = () => {
    if (status !== 'idle' && status !== 'error') return;
    SOSService.startSOS('manual');
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
          <Feather name="alert-triangle" size={32} color="#dc2626" style={{ marginBottom: 12 }} />
          <Text style={styles.warningTitle}>Emergency SOS</Text>
          <Text style={styles.warningBody}>
            Pressing this button will immediately send an emergency signal.
          </Text>
        </View>

        {/* Success banner */}
        {(status === 'success' || status === 'cooldown') && !errorMsg ? (
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
          style={[
            styles.sosBtn, 
            { backgroundColor: colors.error, shadowColor: colors.error },
            ((status === 'recording' || status === 'uploading' || status === 'sending') || cooldownRemaining > 0) && styles.sosBtnDisabled
          ]}
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={status !== 'idle' || cooldownRemaining > 0}
        >
          {(status === 'recording' || status === 'uploading' || status === 'sending') ? (
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
      {status === 'countdown' || status === 'recording' || status === 'uploading' || status === 'sending' || status === 'success' ? (
        <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
          <Animated.View style={[styles.countdownCard, { transform: [{ scale: cardScale }] }]}>
            <View style={{ marginBottom: 16 }}>
              {status === 'success' ? (
                <Feather name="check-circle" size={48} color={colors.success} />
              ) : (
                <Feather name="alert-triangle" size={48} color={colors.error} />
              )}
            </View>
            <Text style={styles.overlayTitle}>
              {status === 'success' ? 'SOS Sent' : 'Emergency SOS'}
            </Text>
            <Text style={styles.overlaySubtitle}>
              {status === 'countdown' ? 'Sending emergency alert in' : 
               status === 'recording' ? 'Recording Audio...' : 
               status === 'uploading' ? 'Uploading Audio...' : 
               status === 'sending' ? 'Sending SOS...' : ''}
            </Text>
            
            {status === 'countdown' && (
              <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: numberScale }] }]}>
                {countdown}
              </Animated.Text>
            )}

            {status === 'recording' && (
              <Text style={styles.countdownNumber}>{recordingTimeLeft}</Text>
            )}

            {(status === 'uploading' || status === 'sending') && (
              <ActivityIndicator size="large" color={colors.error} style={{ marginVertical: 20 }} />
            )}
            
            {status === 'countdown' && (
              <>
                <Text style={styles.overlayDisclaimer}>
                  Emergency contacts will be notified{'\n'}unless you cancel.
                </Text>
                
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={async () => {
                    // Pause countdown while PIN is entered
                    setIsCountdownPaused(true);
                    // Pass 3 seconds (3000ms) to allow the user to type before resuming
                    const validated = await PinService.requestPinValidation(3000);
                    if (validated) {
                      SOSService.cancelSOS();
                      Alert.alert('SOS Cancelled', 'The emergency alert has been cancelled.');
                    }
                    setIsCountdownPaused(false);
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
    color: '#4F46E5',
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
    backgroundColor: '#FEE2E2', // M3 Error Container
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#DC2626', // M3 Error
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
    color: '#DC2626', // M3 Error
    marginBottom: 10,
    textAlign: 'center',
  },
  warningBody: {
    fontSize: 15,
    color: '#DC2626', // M3 Error
    textAlign: 'center',
    lineHeight: 22,
  },

  // Success banner
  successBanner: {
    width: '100%',
    backgroundColor: '#E3F2EC', // M3 Success Container
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4D9375', // M3 Success
    alignItems: 'center',
  },
  successText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4D9375', // M3 Success
    textAlign: 'center',
  },

  // Error banner
  errorBanner: {
    width: '100%',
    backgroundColor: '#FEE2E2', // M3 Error Container
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DC2626', // M3 Error
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626', // M3 Error
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
    color: '#DC2626', // Keep hardcoded or inline: handled in render? Let's just update the hex to match exactly.
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

