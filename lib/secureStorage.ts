import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WEB_KEY_PREFIX = "@nookly:web-secure:";

const getWebKey = (key: string): string =>
  `${WEB_KEY_PREFIX}${key}`;

export const setSecureValue = async (
  key: string,
  value: string,
): Promise<void> => {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(
      getWebKey(key),
      value,
    );
    return;
  }

  await SecureStore.setItemAsync(key, value);
};

export const getSecureValue = async (
  key: string,
): Promise<string | null> => {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(getWebKey(key));
  }

  return SecureStore.getItemAsync(key);
};

export const deleteSecureValue = async (
  key: string,
): Promise<void> => {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(getWebKey(key));
    return;
  }

  await SecureStore.deleteItemAsync(key);
};
