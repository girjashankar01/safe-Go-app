import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import AudioPlaybackService, { PlaybackPriority } from '../services/AudioPlaybackService';
import RecordingCacheService from '../services/RecordingCacheService';
import EmergencyHistoryService from '../services/EmergencyHistoryService';

interface AudioPlayerProps {
  incidentId: string;
  hasRecording: boolean;
  recordingDuration: number | null;
  recordingSize: number | null;
}

export default function AudioPlayer({ incidentId, hasRecording, recordingDuration, recordingSize }: AudioPlayerProps) {
  const [downloadState, setDownloadState] = useState<'Missing' | 'Cloud' | 'Downloading' | 'Downloaded'>('Missing');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [playbackState, setPlaybackState] = useState<'Idle' | 'Loading' | 'Playing' | 'Failed'>('Idle');
  const [localUri, setLocalUri] = useState<string | null>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!hasRecording) {
      setDownloadState('Missing');
      return;
    }
    checkStatus();
  }, [incidentId, hasRecording]);

  const checkStatus = async () => {
    const exists = await RecordingCacheService.exists(incidentId);
    if (exists) {
      setDownloadState('Downloaded');
      setLocalUri(RecordingCacheService.getLocalPath(incidentId));
    } else {
      setDownloadState('Cloud');
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (playbackState === 'Playing') {
      interval = setInterval(() => {
        setCurrentTime(AudioPlaybackService.getCurrentTime());
        const d = AudioPlaybackService.getDuration();
        if (d > 0) setDuration(d);
        
        // If it stopped playing externally
        if (AudioPlaybackService.getState() !== 'Playing' && AudioPlaybackService.getState() !== 'Loading') {
          setPlaybackState('Idle');
        }
      }, 250);
    } else {
      setCurrentTime(0);
    }
    return () => clearInterval(interval);
  }, [playbackState]);

  const formatSize = (bytes: number | null) => {
    if (bytes == null) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleAction = async () => {
    if (playbackState === 'Playing') {
      AudioPlaybackService.stop();
      setPlaybackState('Idle');
      return;
    }

    if (downloadState === 'Downloaded' && localUri) {
      setPlaybackState('Loading');
      try {
        await AudioPlaybackService.playUri(localUri, PlaybackPriority.HIGH);
        setPlaybackState('Playing');
      } catch (e) {
        setPlaybackState('Failed');
      }
    } else if (downloadState === 'Cloud') {
      // Download first, then play
      setDownloadState('Downloading');
      setDownloadProgress(0);
      try {
        const audioData = await EmergencyHistoryService.getAudioUrl(incidentId);
        if (audioData && audioData.url) {
          const uri = await RecordingCacheService.download(incidentId, audioData.url, (progress) => {
            setDownloadProgress(progress);
          });
          
          if (uri) {
            setDownloadState('Downloaded');
            setLocalUri(uri);
            setPlaybackState('Loading');
            await AudioPlaybackService.playUri(uri, PlaybackPriority.HIGH);
            setPlaybackState('Playing');
          } else {
            setDownloadState('Cloud');
            setPlaybackState('Failed');
          }
        } else {
          setDownloadState('Cloud');
          setPlaybackState('Failed');
        }
      } catch (e) {
        setDownloadState('Cloud');
        setPlaybackState('Failed');
      }
    }
  };

  const handleDelete = async () => {
    if (downloadState === 'Downloaded') {
      AudioPlaybackService.stop();
      setPlaybackState('Idle');
      await RecordingCacheService.delete(incidentId);
      setDownloadState('Cloud');
      setLocalUri(null);
    }
  };

  const formatTime = (sec: number) => {
    const totalSeconds = Math.floor(sec);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!hasRecording) {
    return (
      <View style={styles.container}>
        <Text style={styles.missingText}>No audio recording available.</Text>
      </View>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.playButton} onPress={handleAction}>
          {playbackState === 'Loading' || downloadState === 'Downloading' ? (
            <Ionicons name="hourglass-outline" size={24} color="#FFFFFF" />
          ) : playbackState === 'Playing' ? (
            <Ionicons name="pause" size={24} color="#FFFFFF" />
          ) : (
            <Ionicons name="play" size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
        
        <View style={styles.infoContainer}>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{recordingDuration != null ? `${recordingDuration} sec` : 'Unknown duration'}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{formatSize(recordingSize)}</Text>
          </View>
          
          {playbackState === 'Playing' || playbackState === 'Loading' ? (
            <View style={styles.playbackRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              {downloadState === 'Downloaded' && (
                <View style={[styles.badge, styles.badgeDownloaded]}>
                  <Text style={styles.badgeText}>Downloaded</Text>
                </View>
              )}
              {downloadState === 'Cloud' && (
                <View style={[styles.badge, styles.badgeCloud]}>
                  <Text style={styles.badgeText}>Cloud</Text>
                </View>
              )}
              {downloadState === 'Downloading' && (
                <Text style={styles.downloadProgressText}>Downloading... {downloadProgress}%</Text>
              )}
              {playbackState === 'Failed' && (
                <Text style={styles.errorText}>Playback Failed</Text>
              )}
            </View>
          )}
        </View>

        {downloadState === 'Downloaded' && playbackState !== 'Playing' && playbackState !== 'Loading' && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#DDE4E2',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    color: '#1A1C1C',
    fontSize: 14,
    fontWeight: '500',
  },
  metaDot: {
    color: '#5C6564',
    marginHorizontal: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  badgeDownloaded: {
    backgroundColor: '#E3F2EC',
  },
  badgeCloud: {
    backgroundColor: '#E5F2F1',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  downloadProgressText: {
    color: '#0F766E',
    fontSize: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  missingText: {
    color: '#5C6564',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    color: '#5C6564',
    fontSize: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#DDE4E2',
    borderRadius: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0F766E',
  }
});
