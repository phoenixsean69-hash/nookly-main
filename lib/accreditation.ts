// lib/accreditation.ts

// Keywords for positive reviews
const POSITIVE_KEYWORDS = [
  'good', 'clean', 'nice', 'safe', 'spacious', 
  'recommended', 'peaceful', 'great', 'excellent', 
  'amazing', 'wonderful', 'fantastic', 'perfect',
  'beautiful', 'comfortable', 'convenient', 'quiet'
];

/**
 * Check if a property is accredited by Nookly
 * Criteria:
 * 1. 3+ reviews
 * 2. At least 50% of reviews contain positive keywords
 * 3. Property has been on platform for 90+ days
 */
export const isAccredited = (
  reviews: string | any[] | null | undefined,
  createdAt: string | null | undefined
): boolean => {
  // Handle null/undefined reviews
  if (!reviews) return false;
  
  // Parse reviews if they're a string
  let parsedReviews: any[] = [];
  if (typeof reviews === 'string') {
    try {
      parsedReviews = JSON.parse(reviews);
    } catch {
      parsedReviews = [];
    }
  } else if (Array.isArray(reviews)) {
    parsedReviews = reviews;
  }

  // ✅ Check: At least 3 reviews
  if (parsedReviews.length < 3) {
    return false;
  }

  // ✅ Check: At least 50% of reviews contain positive keywords
  const positiveReviews = parsedReviews.filter((review) => {
    const text = review.review?.toLowerCase() || '';
    return POSITIVE_KEYWORDS.some((keyword) => text.includes(keyword));
  });

  if (positiveReviews.length < parsedReviews.length / 2) {
    return false;
  }

  // ✅ Check: Property has been on platform for 90+ days
  if (!createdAt) return false;
  
  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) return false; // Invalid date
  
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 90) {
    return false;
  }

  return true;
};

/**
 * Get accreditation details with count
 */
export const getAccreditationDetails = (
  reviews: string | any[] | null | undefined,
  createdAt: string | null | undefined
): { isAccredited: boolean; positiveReviewCount: number; totalReviews: number; daysOnPlatform: number } => {
  // ✅ Handle null/undefined reviews
  let parsedReviews: any[] = [];
  if (reviews) {
    if (typeof reviews === 'string') {
      try {
        parsedReviews = JSON.parse(reviews);
      } catch {
        parsedReviews = [];
      }
    } else if (Array.isArray(reviews)) {
      parsedReviews = reviews;
    }
  }

  const positiveReviews = parsedReviews.filter((review) => {
    const text = review.review?.toLowerCase() || '';
    return POSITIVE_KEYWORDS.some((keyword) => text.includes(keyword));
  });

  // ✅ Handle null/undefined createdAt - FIXED
  let daysOnPlatform = 0;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    if (!isNaN(createdDate.getTime())) {
      const now = new Date();
      daysOnPlatform = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    isAccredited: parsedReviews.length >= 3 && 
                  positiveReviews.length >= parsedReviews.length / 2 && 
                  daysOnPlatform >= 90,
    positiveReviewCount: positiveReviews.length,
    totalReviews: parsedReviews.length,
    daysOnPlatform,
  };
};