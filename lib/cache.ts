import AsyncStorage from "@react-native-async-storage/async-storage";

export const storeData = async (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) {
    console.error("Error storing data", e);
  }
};

export const getData = async (key: string) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Error getting data", e);
  }
};

export const dataCache = {
  get: async <T>(key: string): Promise<T | null> => {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  set: async (key: string, value: any, ttl: number) => {
    const item = { value, expires: Date.now() + ttl };
    await AsyncStorage.setItem(key, JSON.stringify(item));
  },
  invalidate: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

export const removeData = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error("Error removing data", e);
  }
};
