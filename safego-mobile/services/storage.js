import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'safego_auth_token';

export const saveToken = (token) => AsyncStorage.setItem(TOKEN_KEY, token);

export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);

export const removeToken = () => AsyncStorage.removeItem(TOKEN_KEY);
