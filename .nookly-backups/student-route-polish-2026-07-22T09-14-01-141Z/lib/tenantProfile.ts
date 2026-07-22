// lib/tenantProfile.ts
import { ID, Query } from "react-native-appwrite";
import { LandlordReview, TenantProfile, TenantScore } from "../types/tenant";
import { config, databases } from "./appwrite";

const COLLECTION_ID = config.tenantProfilesCollectionId! || "tenant_profiles";

// Get or create tenant profile
export const getOrCreateTenantProfile = async (userId: string): Promise<TenantProfile | null> => {
  try {
    // Check if profile exists
    const existing = await databases.listDocuments(
      config.databaseId!,
      COLLECTION_ID,
      [Query.equal("userId", userId)]
    );

    if (existing.documents.length > 0) {
      return existing.documents[0] as unknown as TenantProfile;
    }

    // Create new profile
    const now = new Date().toISOString();
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
        createdAt: now,
        updatedAt: now,
      }
    );

    return newProfile as unknown as TenantProfile;
  } catch (error) {
    console.error("Error getting/creating tenant profile:", error);
    return null;
  }
};

// Calculate tenant score
export const calculateTenantScore = (
  idVerified: boolean,

  landlordReviews: LandlordReview[],
  onTimePayments: number,
  totalPayments: number,

): TenantScore => {
  // 1. ID Verification (0-100)
  const idVerificationScore = idVerified ? 100 : 0;



  // 3. Landlord Reviews (0-100)
  const reviewCount = landlordReviews.length;
  let landlordReviewScore = 0;
  if (reviewCount > 0) {
    const avgReview = landlordReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;
    landlordReviewScore = (avgReview / 5) * 100;
  }

  // 4. Payment Reliability (0-100)
  const paymentReliability = totalPayments > 0 
    ? (onTimePayments / totalPayments) * 100 
    : 0;
  const paymentScore = Math.min(paymentReliability, 100);

  // Calculate overall score (weighted average)
  const weights = {
    idVerification: 20,

    landlordReviews: 25,
    paymentReliability: 20,
  };

  const weightedScore = 
    (idVerificationScore * weights.idVerification) +

    (landlordReviewScore * weights.landlordReviews) +
    (paymentScore * weights.paymentReliability)

  const overall = Number(((weightedScore / 100) / 5 * 5).toFixed(1));



  return {
    overall,
    idVerified,

    landlordReviewCount: reviewCount,
    landlordReviewAverage: reviewCount > 0 
      ? Number((landlordReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
      : 0,
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

// Update tenant profile with new score
export const updateTenantProfileScore = async (userId: string): Promise<TenantProfile | null> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return null;


    const landlordReviews = profile.landlordReviews || [];
    const onTimePayments = profile.onTimePayments || 0;
    const totalPayments = profile.totalPayments || 0;


    const score = calculateTenantScore(
      profile.isIdVerified || false,

      landlordReviews,
      onTimePayments,
      totalPayments

    );

    // Update profile with new score
    const updated = await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      {
        tenantScore: score.overall,
        updatedAt: new Date().toISOString(),
      }
    );

    return updated as unknown as TenantProfile;
  } catch (error) {
    console.error("Error updating tenant profile score:", error);
    return null;
  }
};

// Get tenant score for display
export const getTenantScore = async (userId: string): Promise<TenantScore | null> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return null;


    const landlordReviews = profile.landlordReviews || [];

    return calculateTenantScore(
      profile.isIdVerified || false,

      landlordReviews,
      profile.onTimePayments || 0,
      profile.totalPayments || 0,

    );
  } catch (error) {
    console.error("Error getting tenant score:", error);
    return null;
  }
};


// Add landlord review
export const addLandlordReview = async (
  userId: string,
  review: LandlordReview
): Promise<boolean> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return false;

    const reviews = profile.landlordReviews || [];
    reviews.push(review);

    await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      {
        landlordReviews: JSON.stringify(reviews),
      }
    );

    await updateTenantProfileScore(userId);
    return true;
  } catch (error) {
    console.error("Error adding landlord review:", error);
    return false;
  }
};

// Record payment
export const recordPayment = async (
  userId: string,
  onTime: boolean
): Promise<boolean> => {
  try {
    const profile = await getOrCreateTenantProfile(userId);
    if (!profile) return false;

    const onTimePayments = (profile.onTimePayments || 0) + (onTime ? 1 : 0);
    const totalPayments = (profile.totalPayments || 0) + 1;

    await databases.updateDocument(
      config.databaseId!,
      COLLECTION_ID,
      profile.$id,
      {
        onTimePayments,
        totalPayments,
        paymentReliability: (onTimePayments / totalPayments) * 100,
      }
    );

    await updateTenantProfileScore(userId);
    return true;
  } catch (error) {
    console.error("Error recording payment:", error);
    return false;
  }
};