import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';
import { lightColors, darkColors, ThemePalette } from './colors';

type ThemeContextType = {
  isDark: boolean;
  colors: ThemePalette;
  setTheme: (scheme: ColorSchemeName) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightColors,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    setIsDark(systemScheme === 'dark');
  }, [systemScheme]);

  const setTheme = (scheme: ColorSchemeName) => {
    if (scheme === 'dark') setIsDark(true);
    else if (scheme === 'light') setIsDark(false);
    else setIsDark(systemScheme === 'dark');
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
