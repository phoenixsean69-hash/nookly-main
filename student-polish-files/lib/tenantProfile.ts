import { ID, Query } from "react-native-appwrite";
import { LandlordReview, TenantProfile, TenantScore } from "../types/tenant";
import { config, databases } from "./appwrite";

const COLLECTION_ID = config.tenantProfilesCollectionId || "tenant_profiles";

const parseLandlordReviews = (value: unknown): LandlordReview[] => {
  if (Array.isArray(value)) return value as LandlordReview[];
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as LandlordReview[]) : [];
  } catch {
    return [];
  }
};

export const getOrCreateTenantProfile = async (
  userId: string,
): Promise<TenantProfile | null> => {
  try {
    const existing = await databases.listDocuments(
      config.databaseId!,
      COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(1)],
    );

    if (existing.documents.length > 0) {
      return existing.documents[0] as unknown as TenantProfile;
    }

    // Appwrite provides $createdAt and $updatedAt automatically.
    const newProfile = await databases.createDocument(
      config.databaseId!,
      COLLECTION_ID,
      ID.unique(),
      {
        userId,
        tenantScore: 0,
        isIdVerified: false,
        landlordReviews: JSON.stringify([]),
        onTimePayments: 0,
        totalPayments: 0,
        paymentReliability: 0,
        previousLandlords: [],
        totalRentalMonths: 0,
        screeningStatus: "none",
      },
    );

    return newProfile as unknown as TenantProfile;
  } catch (error) {
    console.error("Error getting/creating tenant profile:", error);
    return null;
  }
};

export const calculateTenantScore = (
  idVerified: boolean,
  landlordReviews: LandlordReview[],
  onTimePayments: number,
  totalPayments: number,
): TenantScore => {
  const idVerificationScore = idVerified ? 100 : 0;
  const reviewCount = landlordReviews.length;
  const landlordReviewAverage =
    reviewCount > 0
      ? landlordReviews.reduce(
          (total, review) => total + Number(review.rating ?? 0),
          0,
        ) / reviewCount
      : 0;
  const landlordReviewScore = (landlordReviewAverage / 5) * 100;
  const paymentReliability =
    totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;
  const paymentScore = Math.min(paymentReliability, 100);
  const weightedTotal =
    idVerificationScore * 0.4 +
    landlordReviewScore * 0.35 +
    paymentScore * 0.25;

  return {
    overall: Number(weightedTotal.toFixed(1)),
    idVerified,
    landlordReviewCount: reviewCount,
    landlordReviewAverage: Number(landlordReviewAverage.toFixed(1)),
    onTimePaymentRate: Number(paymentReliability.toFixed(0)),
    previousLandlordCount: 0,
    screeningStatus: "none",
    scoreBreakdown: {
      idVerification: idVerificationScore,
      landlordReviews: landlordReviewScore,
      paymentReliability: paymentScore,
    },
  };
};

export const updateTenantProfileScore = async (
  userId: string,
): Promise<TenantProfile | null> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return null;

    const score = calculateTenantScore(
      profile.isIdVerified || false,
      parseLandlordReviews(profile.landlordReviews),
      profile.onTimePayments || 0,
      profile.totalPayments || 0,
    );

    const updated = await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      { tenantScore: score.overall },
    );

    return updated as unknown as TenantProfile;
  } catch (error) {
    console.error("Error updating tenant profile score:", error);
    return null;
  }
};

export const getTenantScore = async (
  userId: string,
): Promise<TenantScore | null> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return null;

    return calculateTenantScore(
      profile.isIdVerified || false,
      parseLandlordReviews(profile.landlordReviews),
      profile.onTimePayments || 0,
      profile.totalPayments || 0,
    );
  } catch (error) {
    console.error("Error getting tenant score:", error);
    return null;
  }
};

export const addLandlordReview = async (
  userId: string,
  review: LandlordReview,
): Promise<boolean> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return false;

    const reviews = parseLandlordReviews(profile.landlordReviews);
    reviews.push(review);

    await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      { landlordReviews: JSON.stringify(reviews) },
    );

    await updateTenantProfileScore(userId);
    return true;
  } catch (error) {
    console.error("Error adding landlord review:", error);
    return false;
  }
};

export const recordPayment = async (
  userId: string,
  onTime: boolean,
): Promise<boolean> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return false;

    const onTimePayments =
      (profile.onTimePayments || 0) + (onTime ? 1 : 0);
    const totalPayments = (profile.totalPayments || 0) + 1;

    await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      {
        onTimePayments,
        totalPayments,
        paymentReliability: (onTimePayments / totalPayments) * 100,
      },
    );

    await updateTenantProfileScore(userId);
    return true;
  } catch (error) {
    console.error("Error recording payment:", error);
    return false;
  }
};
