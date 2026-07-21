import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getTrips } from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTripDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTripTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchTrips = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const data = await getTrips();
      setTrips(data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isSos = item.status === 'sos';
    const isActive = item.status === 'active' || item.status === 'sos'; // assuming SOS means active, but strictly backend status
    
    // Status text
    let statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
    if (isSos) statusLabel = 'SOS Triggered';
    else if (isActive && item.status !== 'active') statusLabel = 'Active'; // fallback if backend uses other strings

    // Status styling
    let badgeStyle = styles.badgeCompleted;
    let badgeTextStyle = styles.badgeTextCompleted;
    if (isSos) {
      badgeStyle = styles.badgeSos;
      badgeTextStyle = styles.badgeTextSos;
    } else if (item.status === 'active') {
      badgeStyle = styles.badgeActive;
      badgeTextStyle = styles.badgeTextActive;
    }

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatTripDate(item.startedAt)}</Text>
          <View style={[styles.badge, badgeStyle]}>
            <Text style={[styles.badgeText, badgeTextStyle]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Started</Text>
            <Text style={styles.timeValue}>{formatTripTime(item.startedAt)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Ended</Text>
            <Text style={styles.timeValue}>{item.endedAt ? formatTripTime(item.endedAt) : '—'}</Text>
          </View>

          <View style={styles.divider} />
          
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Duration</Text>
            <Text style={styles.timeValue}>
              {item.endedAt ? computeDuration(item.startedAt, item.endedAt) : 'Trip Active'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null; // Wait for load
    
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Couldn't load trip history.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchTrips()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>No trips yet</Text>
        <Text style={styles.emptySubtitle}>Start your first trip to build your history.</Text>
      </View>
    );
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
        <Text style={styles.headerTitle}>Trip History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshing={refreshing}
          onRefresh={() => fetchTrips(true)}
        />
      )}
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

  // List content
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Center States (Empty / Error / Loading)
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  
  // Badges
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeCompleted: {
    backgroundColor: '#f3f4f6',
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
  },
  badgeSos: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeTextCompleted: {
    color: '#4b5563',
  },
  badgeTextActive: {
    color: '#15803d',
  },
  badgeTextSos: {
    color: '#b91c1c',
  },

  // Card Body
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timeLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 4,
  },
});
