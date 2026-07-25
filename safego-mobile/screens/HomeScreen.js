import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  Image
} from 'react-native';
import { getMe } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import { getSettings } from '../services/SettingsService';
import FakeCallService from '../services/FakeCallService';
import { useSafetyIdentity } from '../components/SafetyIdentityContext';
import { Feather } from '@expo/vector-icons';
import EmergencyDirectoryService from '../services/EmergencyDirectoryService';
import EmergencyHistoryService from '../services/EmergencyHistoryService';
import SOSService from '../services/SOSService';
import EmergencyAlarmService from '../services/EmergencyAlarmService';
import { hasActiveTrip, restoreTrip } from '../lib/tripState';
import SystemStatusCard from '../components/SystemStatusCard';
import { useTheme, spacing, typography, radius } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ActionCard } from '../components/ui/ActionCard';
import { ScreenContainer } from '../components/ui/ScreenContainer';

// ─── Hold-to-Activate SOS Button ────────────────────────────────────────────────
function HoldToActivateButton({ onActivate }) {
  const { colors } = useTheme();
  const holdProgress = useRef(new Animated.Value(0)).current;
  const buttonSize = Math.min(220, Dimensions.get('window').width * 0.55);

  const startHold = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000, // 2 seconds
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onActivate();
        holdProgress.setValue(0);
      }
    });
  };

  const cancelHold = () => {
    Animated.timing(holdProgress).stop();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const progressSize = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [buttonSize, buttonSize + 60]
  });

  return (
    <View style={styles.holdContainer}>
      <TouchableOpacity 
        style={[styles.holdTouchable, { width: buttonSize + 60, height: buttonSize + 60 }]}
        onPressIn={startHold}
        onPressOut={cancelHold}
        activeOpacity={1}
      >
        <Animated.View 
          style={[
            styles.holdProgress, 
            { 
              width: progressSize, 
              height: progressSize, 
              borderRadius: Animated.divide(progressSize, 2),
              backgroundColor: colors.danger + '30' // slightly less opacity
            }
          ]} 
        />
        <View style={[
          styles.holdInnerCircle, 
          { 
            width: buttonSize, 
            height: buttonSize, 
            borderRadius: buttonSize / 2, 
            backgroundColor: colors.danger, 
            shadowColor: colors.danger,
            shadowOpacity: 0.2, // reduced
            shadowRadius: 8, // reduced
            elevation: 4
          }
        ]}>
          <Text style={[styles.holdText]}>SOS</Text>
        </View>
      </TouchableOpacity>
      <Text style={[styles.holdSubtext, { color: colors.secondaryText }]}>
        Press & Hold{'\n'}2 seconds
      </Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { profile, missingFields, status: profileStatus } = useSafetyIdentity();
  
  const [socketStatus, setSocketStatus] = useState(
    getSocket().connected ? 'connected' : 'connecting'
  );
  const [fakeCallState, setFakeCallState] = useState({ status: 'Idle', remainingDelay: 0 });
  const [dirState, setDirState] = useState('Loading');
  const [alarmState, setAlarmState] = useState({ status: 'Idle' });
  const [tripActive, setTripActive] = useState(false);
  const [historyItems, setHistoryItems] = useState(EmergencyHistoryService.getCachedHistory());

  useEffect(() => {
    const unsub = FakeCallService.subscribe((s) => setFakeCallState(s));
    return unsub;
  }, []);

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onConnect      = () => setSocketStatus('connected');
    const onDisconnect   = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('error');
    const onReconnecting = () => setSocketStatus('connecting');

    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnecting);
    socket.io.on('reconnect',         onConnect);

    setSocketStatus(socket.connected ? 'connected' : 'connecting');

    const unsubDir = EmergencyDirectoryService.subscribe((s) => setDirState(s));
    EmergencyDirectoryService.initialize();

    // Silently fetch fresh history for background sync
    EmergencyHistoryService.fetchHistory().catch(e => console.log('Silently ignoring fetch history error on home screen', e));

    const unsubHistory = EmergencyHistoryService.subscribe(() => {
      setHistoryItems(EmergencyHistoryService.getCachedHistory());
    });

    const unsubAlarm = EmergencyAlarmService.subscribe((s) => setAlarmState(s));

    return () => {
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnecting);
      socket.io.off('reconnect',         onConnect);
      unsubDir();
      unsubHistory();
      unsubAlarm();
    };
  }, []);

  // Update trip state on focus
  useEffect(() => {
    const checkTrip = async () => {
      await restoreTrip();
      setTripActive(hasActiveTrip());
    };
    checkTrip();
    const unsubscribe = navigation.addListener('focus', checkTrip);
    return unsubscribe;
  }, [navigation]);

  const cachedNumbers = EmergencyDirectoryService.getCachedNumbers();
  const primaryEmergency = cachedNumbers.find(n => n.service_type === 'Emergency' || n.priority === 1) || cachedNumbers[0];
  const womensHelpline = cachedNumbers.find(n => n.service_type === "Women's Helpline" || n.service_name.toLowerCase().includes('women'));
  
  // Pick up to three initials
  const contactInitials = cachedNumbers
    .slice(0, 3)
    .map(n => n.service_name.charAt(0).toUpperCase());

  // ── Loading ────────────────────────────────────────────────────────────────
  if (profileStatus === 'Loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.secondaryText }, typography.subhead]}>Loading your profile…</Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable contentContainerStyle={{ paddingBottom: 85 }}>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.appName, { color: colors.text }]}>SafeGo</Text>
          {profile?.personal?.fullName ? (
            <Text style={[styles.welcomeGreeting, { color: colors.secondaryText }]}>
              Welcome back, {profile.personal.fullName}
            </Text>
          ) : null}
        </View>
        
        <View style={styles.spacer} />

        <TouchableOpacity style={styles.headerRight} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          {profile?.personal?.avatarUrl ? (
            <Image source={{ uri: profile.personal.avatarUrl }} style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {profile?.personal?.fullName ? profile.personal.fullName.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* SOS Button */}
      <HoldToActivateButton onActivate={() => SOSService.triggerManualSOS()} />
      <Text style={[styles.sosInstruction, { color: colors.secondaryText }]}>Emergency services will be alerted immediately</Text>

      {/* System Status */}
      <SystemStatusCard socketStatus={socketStatus} />

      {/* Quick Actions Panel */}
      <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>QUICK ACTIONS</Text>
      <Card style={styles.quickActionsPanel}>
        {/* Row A: Trip Control */}
        <Button
          label={tripActive ? "End Trip" : "Start Trip"}
          variant={tripActive ? "danger" : "primary"}
          style={[styles.tripButton, { width: '100%', marginBottom: spacing.sm }]}
          onPress={() => navigation.navigate('Trip')}
        />

        {/* Row B: Fake Call & Siren */}
        <View style={styles.quickActionsRow}>
          {/* Fake Call Action (dynamic based on state) */}
          {fakeCallState.status === 'Scheduled' ? (
            <Card style={[styles.actionCardContainer, { borderWidth: 0, shadowOpacity: 0, elevation: 0, backgroundColor: colors.surfaceVariant }]}>
               <View style={styles.scheduledCallContent}>
                <Text style={[styles.scheduledCallTitle, { color: colors.text }]}>Call Scheduled</Text>
                <Text style={[styles.scheduledCallSubtitle, { color: colors.primary }]}>{fakeCallState.remainingDelay}s remaining</Text>
                <Button 
                  label="Cancel" 
                  variant="danger" 
                  style={styles.cancelCallBtn} 
                  textStyle={{ ...typography.footnote, color: 'white' }} 
                  onPress={() => FakeCallService.cancel()} 
                />
              </View>
            </Card>
          ) : (
            <ActionCard
              label="Fake Call"
              iconName="phone-call"
              style={styles.actionCardContainer}
              onPress={async () => {
                const settings = await getSettings();
                FakeCallService.start({
                  callerName: settings.fakeCallerName,
                  delay: settings.fakeCallDelay,
                  ringtoneEnabled: settings.fakeCallRingtone,
                  vibrationEnabled: settings.fakeCallVibration,
                  autoEndDuration: settings.fakeCallAutoEnd,
                });
              }}
            />
          )}

          {/* Siren Action */}
          <ActionCard
            label={alarmState.status === 'Playing' || alarmState.status === 'Preparing' ? "Stop Siren" : "Loud Siren"}
            iconName="bell"
            style={styles.actionCardContainer}
            onPress={() => {
              if (alarmState.status === 'Playing' || alarmState.status === 'Preparing') {
                EmergencyAlarmService.stop();
              } else {
                EmergencyAlarmService.start(true, true);
              }
            }}
          />
        </View>

        {/* Row C: Emergency Contacts */}
        <TouchableOpacity style={styles.contactsBar} onPress={() => navigation.navigate('EmergencyContacts')} activeOpacity={0.8}>
          <View style={styles.contactsBarLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
               <Feather name="users" color={colors.primary} size={18} />
            </View>
            <Text style={[styles.contactsBarTitle, { color: colors.text, marginLeft: spacing.sm }]}>Emergency Contacts</Text>
          </View>
          <View style={styles.contactsBarRight}>
            {cachedNumbers.length === 0 ? (
              <Text style={[styles.addContactsText, { color: colors.primary }]}>Add contacts</Text>
            ) : (
              <View style={styles.initialsContainer}>
                {contactInitials.map((initial, i) => (
                  <View key={i} style={[styles.initialBubble, { backgroundColor: colors.primary + '20', borderColor: colors.card }]}>
                    <Text style={[styles.initialText, { color: colors.primary }]}>{initial}</Text>
                  </View>
                ))}
                {cachedNumbers.length > 3 && (
                  <View style={[styles.initialBubble, { backgroundColor: colors.card, borderColor: '#e5e7eb', borderWidth: 1 }]}>
                    <Text style={[styles.initialText, { color: colors.secondaryText }]}>+{cachedNumbers.length - 3}</Text>
                  </View>
                )}
              </View>
            )}
            <Feather name="chevron-right" color={colors.secondaryText} size={20} style={{ marginLeft: spacing.sm }} />
          </View>
        </TouchableOpacity>
      </Card>

      {/* Emergency Resources */}
      <TouchableOpacity onPress={() => navigation.navigate('EmergencyServices')} activeOpacity={0.8}>
        <Card style={styles.resourcesCard}>
          <View style={styles.resourcesHeader}>
            <View style={styles.resourcesHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
                <Feather name="life-buoy" color={colors.primary} size={18} />
              </View>
              <Text style={[styles.resourcesTitle, { color: colors.text, marginLeft: spacing.sm }]}>Emergency Resources</Text>
            </View>
            <Text style={[styles.resourcesLocation, { color: colors.secondaryText }]}>
              {EmergencyDirectoryService.getCurrentLocationStr()}
            </Text>
          </View>
          <View style={styles.resourcesBody}>
            {primaryEmergency && (
              <View style={styles.resourcesRow}>
                <Text style={[styles.resourcesLabel, { color: colors.text }]}>Emergency</Text>
                <Text style={[styles.resourcesValue, { color: colors.text }]}>{primaryEmergency.phone_number}</Text>
              </View>
            )}
            {womensHelpline && (
              <View style={styles.resourcesRow}>
                <Text style={[styles.resourcesLabel, { color: colors.text }]}>Women's Helpline</Text>
                <Text style={[styles.resourcesValue, { color: colors.text }]}>{womensHelpline.phone_number}</Text>
              </View>
            )}
          </View>
          <View style={styles.resourcesAction}>
            <Text style={[styles.resourcesActionText, { color: colors.text }]}>Find Nearby</Text>
            <Feather name="chevron-right" color={colors.secondaryText} size={20} />
          </View>
        </Card>
      </TouchableOpacity>

      {/* Emergency Profile Summary (Moved to bottom) */}
      <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
        <Card style={[styles.identityCard, missingFields.totalMissing > 0 && { borderColor: colors.warning, borderWidth: 1 }]}>
          <View style={styles.identityHeader}>
            {missingFields.totalMissing > 0 ? (
              <Feather name="alert-triangle" size={20} color={colors.warning} />
            ) : (
              <Feather name="shield" size={20} color={colors.primary} />
            )}
            <Text style={[styles.identityTitle, { color: colors.text }]}>
              {missingFields.totalMissing > 0 ? "Incomplete Emergency Info" : "Emergency Profile Ready"}
            </Text>
          </View>
          
          <View style={styles.identityDetails}>
            <View style={styles.identityCol}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Blood Group</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{profile.personal.bloodGroup || '—'}</Text>
            </View>
            <View style={styles.identityCol}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Medical Notes</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{missingFields.medicalInfo ? '—' : 'Available'}</Text>
            </View>
            <View style={styles.identityCol}>
              <Text style={[styles.identityLabel, { color: colors.secondaryText }]}>Last Updated</Text>
              <Text style={[styles.identityValue, { color: colors.text }]}>{new Date(profile.updatedAt).toLocaleDateString()}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>


    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg, // reduced
  },
  headerLeft: {
    flexShrink: 0,
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  headerRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  appName: {
    ...typography.title1,
    letterSpacing: -0.5,
  },
  welcomeGreeting: {
    ...typography.subhead,
    marginTop: 2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    ...typography.headline,
  },
  identityCard: {
    marginBottom: spacing.lg, // reduced
    padding: spacing.lg,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  identityTitle: {
    ...typography.headline,
    marginLeft: spacing.sm,
  },
  identityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identityCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  identityLabel: {
    ...typography.footnote,
    marginBottom: spacing.xs,
  },
  identityValue: {
    ...typography.subhead,
  },
  holdContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg, // reduced
  },
  holdTouchable: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  holdProgress: {
    position: 'absolute',
  },
  holdInnerCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  holdText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  holdSubtext: {
    ...typography.subhead,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  sosInstruction: {
    ...typography.footnote,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.footnote,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  quickActionsPanel: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionCardContainer: {
    flex: 1,
    borderRadius: radius.sm,
  },
  scheduledCallContent: {
    padding: spacing.sm,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduledCallTitle: {
    ...typography.subhead,
    textAlign: 'center',
  },
  scheduledCallSubtitle: {
    ...typography.footnote,
    marginTop: 2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  cancelCallBtn: {
    height: 32,
    paddingHorizontal: spacing.sm,
    width: '100%',
  },
  tripButton: {
    borderRadius: radius.sm,
  },
  contactsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
  },
  contactsBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactsBarTitle: {
    ...typography.subhead,
  },
  contactsBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addContactsText: {
    ...typography.footnote,
  },
  contactsCard: {
    marginBottom: spacing.lg, // reduced
  },
  contactsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactsTitle: {
    ...typography.headline,
    marginBottom: spacing.sm,
  },
  initialsContainer: {
    flexDirection: 'row',
  },
  initialBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    borderWidth: 2,
  },
  initialText: {
    ...typography.subhead,
    fontWeight: '600',
  },
  historyCard: {
    marginBottom: spacing.lg,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  historyTitle: {
    ...typography.headline,
  },
  historyBody: {
    marginBottom: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyLabel: {
    ...typography.body,
  },
  historyValue: {
    ...typography.body,
  },
  historyEmpty: {
    ...typography.body,
  },
  resourcesCard: {
    marginBottom: spacing.lg,
  },
  resourcesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resourcesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourcesTitle: {
    ...typography.headline,
  },
  resourcesLocation: {
    ...typography.footnote,
  },
  resourcesBody: {
    marginBottom: spacing.md,
  },
  resourcesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  resourcesLabel: {
    ...typography.body,
  },
  resourcesValue: {
    ...typography.body,
  },
  resourcesAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resourcesActionText: {
    ...typography.subhead,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripHistoryCard: {
    marginBottom: spacing.xxxl,
    padding: spacing.lg,
  },
  tripHistoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripHistoryTitle: {
    ...typography.headline,
  }
});
