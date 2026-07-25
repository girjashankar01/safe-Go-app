import { Easing } from 'react-native-reanimated';

export const motion = {
  duration: {
    fast: 100,
    normal: 200,
    slow: 300,
    holdSOS: 2000,
    sirenPulse: 1000,
  },
  easing: {
    pressOut: Easing.out(Easing.ease), // button press-down feedback
    entrance: Easing.inOut(Easing.ease), // card fade/translateY entrance
    pulse: Easing.inOut(Easing.ease), // SOS/siren pulse loops
    theme: Easing.inOut(Easing.ease), // theme crossfade
  },
};
