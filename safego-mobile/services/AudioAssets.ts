// This file centrally manages all audio assets for the application.

export const AudioAssets = {
  alarm: require('../assets/audio/loud-emergency-alarm-01.mp3'),
  ringtone: require('../assets/audio/iphone_original_ringtone.mp3'),
  notification: require('../assets/audio/notification.wav'),
};

export type AudioAssetType = keyof typeof AudioAssets;
