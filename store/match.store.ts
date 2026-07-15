// store/match.store.ts
import { getMatchProfiles, getUserMatchProfile } from "@/lib/appwrite";
import notificationService from "@/services/notification.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

interface MatchStore {
  matchCount: number;
  previousMatchCount: number;
  setMatchCount: (count: number) => void;
  markMatchesAsViewed: () => Promise<void>;
  fetchMatchCount: (userId: string) => Promise<void>;
  getRemainingTime: () => Promise<number>;
  checkAndNotifyNewMatches: (
    userId: string,
    newMatches: any[],
  ) => Promise<void>;
}

export const useMatchStore = create<MatchStore>((set, get) => ({
  matchCount: 0,
  previousMatchCount: 0,

  setMatchCount: (count) => set({ matchCount: count }),

  markMatchesAsViewed: async () => {
    const hideUntil = Date.now() + 1 * 60 * 1000; // 1 minute from now
    await AsyncStorage.setItem("match_badge_hide_until", hideUntil.toString());
    set({ matchCount: 0, previousMatchCount: 0 });
  },

  getRemainingTime: async () => {
    const hideUntil = await AsyncStorage.getItem("match_badge_hide_until");
    if (!hideUntil) return 0;

    const remaining = parseInt(hideUntil) - Date.now();
    return remaining > 0 ? remaining : 0;
  },

  // Check for new matches and send notifications
  checkAndNotifyNewMatches: async (userId: string, newMatches: any[]) => {
    try {
      if (newMatches.length === 0) return;

      // Get previously notified matches
      const notifiedMatchesKey = `notified_matches_${userId}`;
      const notifiedMatchesStr = await AsyncStorage.getItem(notifiedMatchesKey);
      const notifiedMatches = notifiedMatchesStr
        ? JSON.parse(notifiedMatchesStr)
        : [];

      // Find truly new matches (not notified before)
      const trulyNewMatches = newMatches.filter(
        (match) => !notifiedMatches.includes(match.$id),
      );

      if (trulyNewMatches.length === 0) return;

      // Save these as notified
      const updatedNotified = [
        ...notifiedMatches,
        ...trulyNewMatches.map((m) => m.$id),
      ];
      await AsyncStorage.setItem(
        notifiedMatchesKey,
        JSON.stringify(updatedNotified),
      );

      // Send notification for each new match (or batch them)
      for (const match of trulyNewMatches.slice(0, 3)) {
        // Limit to 3 notifications
        await notificationService.sendMatchNotification(
          userId,
          match.name,
          match.preferredLocation,
        );
      }

      // If more than 3 matches, send a summary notification
      if (trulyNewMatches.length > 3) {
        await notificationService.sendNotificationToUser(
          userId,
          "Multiple New Matches",
          `You have ${trulyNewMatches.length} new potential roommates waiting!`,
          { type: "match", screen: "match" },
        );
      }

      console.log(
        `📱 Sent ${Math.min(trulyNewMatches.length, 3)} match notifications`,
      );
    } catch (error) {
      console.error("Error sending match notifications:", error);
    }
  },

  fetchMatchCount: async (userId: string) => {
    try {
      // Check if badge is hidden
      const hideUntil = await AsyncStorage.getItem("match_badge_hide_until");
      if (hideUntil && Date.now() < parseInt(hideUntil)) {
        set({ matchCount: 0 });
        return;
      }

      const myProfile = await getUserMatchProfile(userId);

      if (!myProfile?.preferredLocation) {
        set({ matchCount: 0, previousMatchCount: 0 });
        return;
      }

      // ✅ Pass all required filters — same as match.tsx does
      const matches = await getMatchProfiles({
        location: myProfile.preferredLocation,
        myGender: myProfile.gender as "male" | "female",
        preferredGender: myProfile.preferredGender as "male" | "female",
        myBudget: myProfile.budget,
      });

      const filteredMatches = matches.filter((m: any) => m.userId !== userId);
      const newMatchCount = filteredMatches.length;
      const previousCount = get().previousMatchCount;

      // Update count
      set({ matchCount: newMatchCount, previousMatchCount: newMatchCount });

      // Check for new matches and notify
      if (newMatchCount > previousCount) {
        const previousMatchesKey = `previous_matches_${userId}`;
        const previousMatchesStr =
          await AsyncStorage.getItem(previousMatchesKey);
        const previousMatchIds = previousMatchesStr
          ? JSON.parse(previousMatchesStr)
          : [];

        const newMatches = filteredMatches.filter(
          (m) => !previousMatchIds.includes(m.$id),
        );

        if (newMatches.length > 0) {
          await get().checkAndNotifyNewMatches(userId, newMatches);
        }

        // Store current match IDs for next comparison
        const currentMatchIds = filteredMatches.map((m) => m.$id);
        await AsyncStorage.setItem(
          previousMatchesKey,
          JSON.stringify(currentMatchIds),
        );
      }
    } catch (error) {
      console.error("Error fetching match count:", error);
      set({ matchCount: 0, previousMatchCount: 0 });
    }
  },
}));
