import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Cross-platform key/value storage for auth tokens.
 * Native uses the OS keychain via expo-secure-store; web falls back to
 * localStorage (SecureStore is not supported on web).
 */
const isWeb = Platform.OS === 'web';

export async function getStorageItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Ignore storage failures (e.g. private mode); session stays in memory.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStorageItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Ignore.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
