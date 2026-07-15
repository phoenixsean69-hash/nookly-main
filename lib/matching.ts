// lib/matching.ts
// Shared roommate matching logic: location overlap, mutual gender check,
// and weighted compatibility scoring so results can be ranked.

export interface MatchInput {
  userId?: string;
  gender?: string;
  preferredGender?: string;
  budget?: number;
  preferredLocation?: string;
  lifestyle?: string[] | string;
  moveInDate?: string;
  lookingFor?: string;
}

// Words that carry no meaning when comparing free-text locations
const LOCATION_STOPWORDS = new Set([
  "near",
  "the",
  "in",
  "at",
  "around",
  "area",
  "close",
  "to",
  "by",
  "of",
  "and",
  "campus",
  "town",
  "city",
]);

/** Parse lifestyle stored as JSON string, comma list, or array into a clean array */
export const normalizeLifestyle = (value?: string[] | string): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fall through to comma-split
  }
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const locationTokens = (location?: string): string[] => {
  if (!location) return [];
  return location
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !LOCATION_STOPWORDS.has(t));
};

/** Bidirectional, token-based location comparison for free-text locations */
export const locationsOverlap = (a?: string, b?: string): boolean => {
  const na = a?.trim().toLowerCase();
  const nb = b?.trim().toLowerCase();
  if (!na || !nb) return false;

  // Direct substring either way (handles "Bindura" vs "Bindura near FSE campus")
  if (na.includes(nb) || nb.includes(na)) return true;

  // Token overlap (handles "near FSE campus, Bindura" vs "Bindura town")
  const tokensA = locationTokens(a);
  const tokensB = new Set(locationTokens(b));
  return tokensA.some((t) => tokensB.has(t));
};

/** Mutual gender compatibility. Missing/empty preference is treated as "any". */
export const gendersCompatible = (me: MatchInput, other: MatchInput): boolean => {
  const wants = (pref?: string, actual?: string) =>
    !pref || pref === "any" || !actual || pref === actual;

  const theyWantMe = wants(other.preferredGender, me.gender);
  const iWantThem = wants(me.preferredGender, other.gender);
  return theyWantMe && iWantThem;
};

const budgetRatio = (a?: number, b?: number): number | null => {
  if (!a || !b || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b);
};

const parseMoveInDate = (value?: string): Date | null => {
  if (!value || value.toLowerCase() === "flexible") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Weighted compatibility score, 0-100.
 * Budget proximity: 40, Lifestyle overlap: 30, Move-in date: 15, Looking-for: 15.
 * Unknown data scores neutral so incomplete profiles are not punished too hard.
 */
export const computeCompatibilityScore = (
  me: MatchInput,
  other: MatchInput,
): number => {
  let score = 0;

  // Budget (40 pts): full points when equal, 0 when 50%+ apart
  const ratio = budgetRatio(me.budget, other.budget);
  if (ratio === null) {
    score += 20; // neutral when a budget is unknown
  } else {
    score += Math.round(40 * Math.max(0, 1 - ratio / 0.5));
  }

  // Lifestyle overlap (30 pts)
  const myLifestyle = normalizeLifestyle(me.lifestyle);
  const theirLifestyle = normalizeLifestyle(other.lifestyle);
  if (myLifestyle.length === 0 || theirLifestyle.length === 0) {
    score += 15; // neutral when either side has no lifestyle info
  } else {
    const theirSet = new Set(theirLifestyle.map((l) => l.toLowerCase()));
    const shared = myLifestyle.filter((l) => theirSet.has(l.toLowerCase())).length;
    const denom = Math.min(myLifestyle.length, theirLifestyle.length);
    score += Math.round(30 * (shared / Math.max(denom, 1)));
  }

  // Move-in date proximity (15 pts)
  const myDate = parseMoveInDate(me.moveInDate);
  const theirDate = parseMoveInDate(other.moveInDate);
  if (!myDate || !theirDate) {
    score += 10; // flexible/unknown dates are mostly fine
  } else {
    const daysApart =
      Math.abs(myDate.getTime() - theirDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysApart <= 14) score += 15;
    else if (daysApart <= 30) score += 10;
    else if (daysApart <= 60) score += 5;
  }

  // Looking-for compatibility (15 pts)
  const mine = me.lookingFor?.toLowerCase() || "";
  const theirs = other.lookingFor?.toLowerCase() || "";
  if (!mine || !theirs) {
    score += 10;
  } else if (mine === theirs || mine === "both" || theirs === "both") {
    score += 15;
  } else {
    score += 5; // e.g. "roommate" vs "place to rent" - still possible
  }

  return Math.min(100, Math.max(0, score));
};

/**
 * Hard requirements a candidate must pass before being scored:
 * not self, mutual gender compatibility, overlapping location,
 * and budgets not absurdly far apart (>60%).
 */
export const isCompatibleMatch = (me: MatchInput, other: MatchInput): boolean => {
  if (me.userId && other.userId && me.userId === other.userId) return false;
  if (!gendersCompatible(me, other)) return false;
  if (!locationsOverlap(me.preferredLocation, other.preferredLocation)) {
    return false;
  }
  const ratio = budgetRatio(me.budget, other.budget);
  if (ratio !== null && ratio > 0.6) return false;
  return true;
};

/** Filter candidates by hard requirements, score them, and sort best-first */
export const rankMatches = <T extends MatchInput>(
  me: MatchInput,
  candidates: T[],
): (T & { matchScore: number })[] => {
  return candidates
    .filter((c) => isCompatibleMatch(me, c))
    .map((c) => ({ ...c, matchScore: computeCompatibilityScore(me, c) }))
    .sort((a, b) => b.matchScore - a.matchScore);
};
