import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import ProfileService from '../services/ProfileService';

interface ProfileAvatarProps {
  avatarUrl?: string;
  fullName: string;
  onChangePhoto?: (uri: string) => void;
}

export default function ProfileAvatar({ avatarUrl, fullName, onChangePhoto }: ProfileAvatarProps) {
  const [loading, setLoading] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const uri = result.assets[0].uri;
        const uploadedUrl = await ProfileService.uploadAvatar(uri);
        if (uploadedUrl && onChangePhoto) {
          onChangePhoto(uploadedUrl);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to update profile photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await ProfileService.removeAvatar();
            if (onChangePhoto) {
              onChangePhoto('');
            }
            setLoading(false);
          }
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        {loading ? (
          <View style={[styles.avatarCircle, styles.loadingCircle]}>
            <ActivityIndicator color="#16a34a" size="large" />
          </View>
        ) : avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarCircle} />
        ) : (
          <View style={[styles.avatarCircle, styles.initialsCircle]}>
            <Text style={styles.initialsText}>{getInitials(fullName)}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={handlePickImage}
          disabled={loading}
        >
          <Feather name="camera" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={handlePickImage} disabled={loading}>
          <Text style={styles.actionText}>Change Photo</Text>
        </TouchableOpacity>
        
        {avatarUrl && (
          <>
            <Text style={styles.bullet}>•</Text>
            <TouchableOpacity onPress={handleRemoveImage} disabled={loading}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
  },
  loadingCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  initialsCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16a34a',
  },
  initialsText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
  },
  editButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#111827',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },
  removeText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  bullet: {
    color: '#9ca3af',
  }
});
