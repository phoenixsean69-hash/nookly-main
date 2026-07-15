// lib/types/tenant.ts



export interface LandlordReview {
  landlordId: string;
  landlordName: string;
  rating: number; // 1-5
  review: string;
  date: string;
  propertyId: string;
  propertyName: string;
}

export interface TenantScore {
  overall: number; // 0-5
  idVerified: boolean;

  landlordReviewCount: number;
  landlordReviewAverage: number;
  onTimePaymentRate: number; // percentage
  previousLandlordCount: number;

  screeningStatus: "pending" | "approved" | "rejected" | "none";
  scoreBreakdown: {
    idVerification: number; // 0-100

    landlordReviews: number; // 0-100
    paymentReliability: number; // 0-100

  };
}

export interface TenantProfile {
  $id: string;
  userId: string;
  tenantScore: number;
  isIdVerified: boolean;
  idVerificationDate?: string;

  landlordReviews: LandlordReview[];
  onTimePayments: number;
  totalPayments: number;
  paymentReliability: number;
  previousLandlords: string[];
  totalRentalMonths: number;
  screeningStatus: "pending" | "approved" | "rejected" | "none";
  screeningDate?: string;
  screeningNotes?: string;
  createdAt: string;
  updatedAt: string;
}