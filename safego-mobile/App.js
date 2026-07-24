import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './theme';

import RootNavigator from './navigation/RootNavigator';

import { setUnauthenticatedHandler } from './lib/api';
import BootstrapService from './services/BootstrapService';
import { SafetyIdentityProvider } from './components/SafetyIdentityContext';

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null); // null = still loading
  const navigationRef = useRef(null);

  // Register the global 401 handler once the navigation ref is ready.
  // This lets the Axios interceptor in api.js navigate to Login without
  // importing the navigator directly (avoids circular dependency).
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
    });
  }, []);

  // Bootstrap app state.
  useEffect(() => {
    const runBootstrap = async () => {
      const { route } = await BootstrapService.initialize();
      setInitialRoute(route);
    };
    runBootstrap();
  }, []);

  if (!initialRoute) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider>
      <View style={{ flex: 1 }}>
        <SafetyIdentityProvider>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator initialRoute={initialRoute} />
          </NavigationContainer>
        </SafetyIdentityProvider>
      </View>
    </ThemeProvider>
  );
}
