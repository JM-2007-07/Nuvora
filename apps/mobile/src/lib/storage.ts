import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small key-value storage for tokens and preferences.
 * - Android / iOS: expo-secure-store (Keystore-backed / Keychain). Tokens never go to plain storage.
 * - Web (the browser preview used during development only): localStorage, because SecureStore has
 *   no web implementation. The web preview is not a product surface.
 */
const web = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (web) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode: keep in memory only */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (web) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
