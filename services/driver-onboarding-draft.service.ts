import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DriverOnboardingInput } from "@/types/driver";

const STORAGE_KEY_PREFIX = "@nookly:driver-onboarding-draft:";

const getStorageKey = (accountId: string): string =>
  `${STORAGE_KEY_PREFIX}${accountId.trim()}`;

export async function saveDriverOnboardingDraft(
  accountId: string,
  draft: DriverOnboardingInput,
): Promise<void> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) return;

  await AsyncStorage.setItem(
    getStorageKey(normalizedAccountId),
    JSON.stringify(draft),
  );
}

export async function loadDriverOnboardingDraft(
  accountId: string,
): Promise<DriverOnboardingInput | null> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) return null;

  try {
    const storedValue = await AsyncStorage.getItem(
      getStorageKey(normalizedAccountId),
    );

    if (!storedValue) return null;

    return JSON.parse(storedValue) as DriverOnboardingInput;
  } catch (error) {
    console.warn("Could not load the saved driver application draft:", error);
    return null;
  }
}

export async function clearDriverOnboardingDraft(
  accountId: string,
): Promise<void> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) return;

  try {
    await AsyncStorage.removeItem(getStorageKey(normalizedAccountId));
  } catch (error) {
    console.warn("Could not clear the saved driver application draft:", error);
  }
}
