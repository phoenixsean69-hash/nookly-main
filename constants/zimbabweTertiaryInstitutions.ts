export type ZimbabweInstitutionCategory =
  | "University"
  | "Polytechnic"
  | "Teachers College"
  | "Industrial Training Centre";

export interface ZimbabweTertiaryInstitution {
  id: string;
  name: string;
  category: ZimbabweInstitutionCategory;
  city: string;
  aliases: string[];
  locationKeywords: string[];
}

const institution = (
  id: string,
  name: string,
  category: ZimbabweInstitutionCategory,
  city: string,
  aliases: string[] = [],
  locationKeywords: string[] = [],
): ZimbabweTertiaryInstitution => ({
  id,
  name,
  category,
  city,
  aliases,
  locationKeywords: Array.from(new Set([city, ...locationKeywords])),
});

/**
 * Core higher and tertiary institutions listed by Zimbabwe's Ministry of
 * Higher and Tertiary Education, Innovation, Science and Technology
 * Development. Aliases are included for common abbreviations and legacy input.
 *
 * The canonical `name` is what Nookly stores in users.schoolLocation.
 */
export const ZIMBABWE_TERTIARY_INSTITUTIONS: ZimbabweTertiaryInstitution[] = [
  // Universities
  institution("au", "Africa University", "University", "Mutare", ["AU"], [
    "Old Mutare",
    "Manicaland",
  ]),
  institution(
    "aju",
    "Arrupe Jesuit University",
    "University",
    "Harare",
    ["Arrupe University", "AJU"],
  ),
  institution(
    "buse",
    "Bindura University of Science Education",
    "University",
    "Bindura",
    ["Bindura University", "BUSE"],
    ["Mashonaland Central"],
  ),
  institution(
    "cut",
    "Chinhoyi University of Technology",
    "University",
    "Chinhoyi",
    ["CUT"],
    ["Mashonaland West"],
  ),
  institution(
    "cuz",
    "Catholic University in Zimbabwe",
    "University",
    "Harare",
    ["Catholic University", "CUZ"],
  ),
  institution(
    "hit",
    "Harare Institute of Technology",
    "University",
    "Harare",
    ["HIT"],
  ),
  institution(
    "gzu",
    "Great Zimbabwe University",
    "University",
    "Masvingo",
    ["GZU"],
  ),
  institution(
    "gsu",
    "Gwanda State University",
    "University",
    "Gwanda",
    ["GSU"],
    ["Filabusi", "Matabeleland South"],
  ),
  institution(
    "msuas",
    "Manicaland State University of Applied Sciences",
    "University",
    "Mutare",
    ["MSUAS", "Manicaland State University"],
    ["Manicaland"],
  ),
  institution(
    "msu",
    "Midlands State University",
    "University",
    "Gweru",
    ["MSU"],
    ["Midlands"],
  ),
  institution(
    "muast",
    "Marondera University of Agricultural Sciences and Technology",
    "University",
    "Marondera",
    ["MUAST", "Marondera University"],
    ["Mashonaland East"],
  ),
  institution(
    "nust",
    "National University of Science and Technology",
    "University",
    "Bulawayo",
    ["NUST"],
  ),
  institution(
    "rcu",
    "Reformed Church University",
    "University",
    "Masvingo",
    ["RCU"],
  ),
  institution(
    "solusi",
    "Solusi University",
    "University",
    "Bulawayo",
    ["Solusi"],
    ["Solusi"],
  ),
  institution(
    "wua",
    "Women's University in Africa",
    "University",
    "Harare",
    ["WUA", "Womens University in Africa"],
  ),
  institution(
    "uz",
    "University of Zimbabwe",
    "University",
    "Harare",
    ["UZ"],
    ["Mount Pleasant"],
  ),
  institution(
    "lsu",
    "Lupane State University",
    "University",
    "Lupane",
    ["LSU"],
    ["Bulawayo", "Matabeleland North"],
  ),
  institution(
    "pamust",
    "Pan African Minerals University of Science and Technology",
    "University",
    "Harare",
    ["PAMUST", "Pan African Minerals University"],
  ),
  institution(
    "zndu",
    "Zimbabwe National Defence University",
    "University",
    "Harare",
    ["ZNDU", "National Defence University"],
  ),
  institution(
    "zou",
    "Zimbabwe Open University",
    "University",
    "Harare",
    ["ZOU", "Open University"],
    [
      "Bulawayo",
      "Mutare",
      "Gweru",
      "Masvingo",
      "Chinhoyi",
      "Bindura",
      "Marondera",
    ],
  ),
  institution(
    "zegu",
    "Zimbabwe Ezekiel Guti University",
    "University",
    "Bindura",
    ["ZEGU", "Ezekiel Guti University"],
    ["Mashonaland Central"],
  ),

  // Polytechnics
  institution(
    "byo-poly",
    "Bulawayo Polytechnic",
    "Polytechnic",
    "Bulawayo",
    ["Bulawayo Poly"],
  ),
  institution(
    "mutare-poly",
    "Mutare Polytechnic",
    "Polytechnic",
    "Mutare",
    ["Mutare Poly"],
  ),
  institution(
    "jm-nkomo-poly",
    "Joshua Mqabuko Nkomo Polytechnic",
    "Polytechnic",
    "Gwanda",
    ["Joshua Nkomo Polytechnic", "JMN Polytechnic"],
    ["Matabeleland South"],
  ),
  institution(
    "gweru-poly",
    "Gweru Polytechnic",
    "Polytechnic",
    "Gweru",
    ["Gweru Poly"],
  ),
  institution(
    "kwekwe-poly",
    "Kwekwe Polytechnic",
    "Polytechnic",
    "Kwekwe",
    ["Kwekwe Poly"],
  ),
  institution(
    "masvingo-poly",
    "Masvingo Polytechnic",
    "Polytechnic",
    "Masvingo",
    ["Masvingo Poly"],
  ),
  institution(
    "kushinga-poly",
    "Kushinga Phikelela Polytechnic",
    "Polytechnic",
    "Marondera",
    ["Kushinga Phikelela", "Kushinga Polytechnic"],
    ["Mashonaland East"],
  ),
  institution(
    "harare-poly",
    "Harare Polytechnic",
    "Polytechnic",
    "Harare",
    ["Harare Poly"],
  ),
  institution(
    "sht",
    "School of Hospitality and Tourism",
    "Polytechnic",
    "Bulawayo",
    ["School of Hospitality & Tourism", "Hospitality and Tourism School"],
  ),

  // Teachers colleges
  institution(
    "bondolfi",
    "Bondolfi Teachers College",
    "Teachers College",
    "Masvingo",
    ["Bondolfi College"],
  ),
  institution(
    "belvedere",
    "Belvedere Technical Teachers College",
    "Teachers College",
    "Harare",
    ["Belvedere Teachers College", "BTTC"],
    ["Belvedere"],
  ),
  institution(
    "becsa",
    "Blended Education College of Southern Africa",
    "Teachers College",
    "Bulawayo",
    ["BECSA"],
  ),
  institution(
    "morgenster",
    "Morgenster Teachers College",
    "Teachers College",
    "Masvingo",
    ["Morgenster College"],
    ["Morgenster"],
  ),
  institution(
    "marymount",
    "Marymount Teachers College",
    "Teachers College",
    "Mutare",
    ["Marymount College"],
  ),
  institution(
    "mkoba",
    "Mkoba Teachers College",
    "Teachers College",
    "Gweru",
    ["Mkoba College"],
    ["Mkoba"],
  ),
  institution(
    "hillside",
    "Hillside Teachers College",
    "Teachers College",
    "Bulawayo",
    ["Hillside College"],
    ["Hillside"],
  ),
  institution(
    "madziwa",
    "Madziwa Teachers College",
    "Teachers College",
    "Madziwa",
    ["Madziwa College"],
    ["Shamva", "Mashonaland Central"],
  ),
  institution(
    "masvingo-tc",
    "Masvingo Teachers College",
    "Teachers College",
    "Masvingo",
    ["Masvingo Teachers"],
  ),
  institution(
    "morgan-zintec",
    "Morgan Zintec Teachers College",
    "Teachers College",
    "Harare",
    ["Morgan Zintec", "Morgan Teachers College"],
  ),
  institution(
    "mutare-tc",
    "Mutare Teachers College",
    "Teachers College",
    "Mutare",
    ["Mutare Teachers"],
  ),
  institution(
    "nyadire",
    "Nyadire Teachers College",
    "Teachers College",
    "Nyadire",
    ["Nyadire College"],
    ["Mutoko", "Mashonaland East"],
  ),
  institution(
    "seke",
    "Seke Teachers College",
    "Teachers College",
    "Chitungwiza",
    ["Seke College"],
    ["Seke"],
  ),
  institution(
    "hwange",
    "Hwange Teachers College",
    "Teachers College",
    "Hwange",
    ["Hwange College"],
    ["Matabeleland North"],
  ),
  institution(
    "uce",
    "United College of Education",
    "Teachers College",
    "Bulawayo",
    ["UCE"],
  ),

  // Industrial training centres
  institution(
    "westgate-itc",
    "Westgate Industrial Training Centre",
    "Industrial Training Centre",
    "Harare",
    ["Westgate ITC", "Westgate Industrial Training College"],
    ["Westgate"],
  ),
  institution(
    "mupfure-itc",
    "Mupfure Industrial Training Centre",
    "Industrial Training Centre",
    "Chegutu",
    ["Mupfure ITC"],
    ["Mashonaland West"],
  ),
  institution(
    "danhiko",
    "Danhiko Project",
    "Industrial Training Centre",
    "Harare",
    ["Danhiko Training Centre", "Danhiko"],
    ["Msasa"],
  ),
  institution(
    "msasa-itc",
    "Msasa Industrial Training Centre",
    "Industrial Training Centre",
    "Harare",
    ["Msasa ITC", "Msasa Industrial Training College"],
    ["Msasa"],
  ),
  institution(
    "st-peters-kubatana",
    "St Peter's Kubatana Industrial Training Centre",
    "Industrial Training Centre",
    "Harare",
    [
      "St Peters Kubatana",
      "St Peter's Kubatana",
      "Kubatana Industrial Training Centre",
    ],
  ),
].sort((left, right) => left.name.localeCompare(right.name));

const INSTITUTION_STOP_WORDS = new Set([
  "a",
  "and",
  "college",
  "education",
  "for",
  "in",
  "institute",
  "institution",
  "of",
  "project",
  "school",
  "science",
  "sciences",
  "state",
  "technical",
  "technology",
  "teachers",
  "tertiary",
  "the",
  "tourism",
  "training",
  "university",
  "polytechnic",
  "zimbabwe",
]);

const LOCATION_STOP_WORDS = new Set([
  ...INSTITUTION_STOP_WORDS,
  "province",
  "district",
]);

export const normalizeInstitutionText = (value?: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const significantTokens = (value?: unknown): string[] =>
  normalizeInstitutionText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !LOCATION_STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );

const normalizedValuesForInstitution = (
  item: ZimbabweTertiaryInstitution,
): string[] =>
  [item.name, item.city, item.category, ...item.aliases, ...item.locationKeywords]
    .map(normalizeInstitutionText)
    .filter(Boolean);

export const findZimbabweInstitution = (
  value?: string | null,
): ZimbabweTertiaryInstitution | null => {
  const normalizedValue = normalizeInstitutionText(value);
  if (!normalizedValue) return null;

  const exact = ZIMBABWE_TERTIARY_INSTITUTIONS.find((item) =>
    [item.name, ...item.aliases]
      .map(normalizeInstitutionText)
      .includes(normalizedValue),
  );

  if (exact) return exact;

  const inputTokens = significantTokens(normalizedValue);
  if (inputTokens.length === 0) return null;

  let best:
    | { item: ZimbabweTertiaryInstitution; score: number }
    | undefined;

  for (const item of ZIMBABWE_TERTIARY_INSTITUTIONS) {
    const values = normalizedValuesForInstitution(item);
    let score = 0;

    for (const candidate of values) {
      if (candidate.includes(normalizedValue)) score = Math.max(score, 90);

      const candidateTokens = new Set(significantTokens(candidate));
      const shared = inputTokens.filter((token) => candidateTokens.has(token));
      score = Math.max(score, shared.length * 20);
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best && best.score >= 20 ? best.item : null;
};

export const getInstitutionCity = (value?: string | null): string => {
  const resolved = findZimbabweInstitution(value);
  return resolved?.city ?? "";
};

export const getInstitutionLocationTerms = (
  value?: string | null,
): string[] => {
  const resolved = findZimbabweInstitution(value);

  if (resolved) {
    return Array.from(
      new Set(
        [
          resolved.city,
          ...resolved.locationKeywords,
          resolved.name,
          ...resolved.aliases,
        ]
          .map(normalizeInstitutionText)
          .filter(Boolean),
      ),
    );
  }

  const normalizedValue = normalizeInstitutionText(value);
  const tokens = significantTokens(normalizedValue);

  return Array.from(
    new Set([
      ...(normalizedValue ? [normalizedValue] : []),
      ...tokens,
    ]),
  );
};

const scoreInstitutionSearch = (
  item: ZimbabweTertiaryInstitution,
  query: string,
): number => {
  if (!query) return 1;

  const values = normalizedValuesForInstitution(item);
  const queryTokens = significantTokens(query);
  let score = 0;

  for (const value of values) {
    if (value === query) score = Math.max(score, 100);
    else if (value.startsWith(query)) score = Math.max(score, 80);
    else if (value.includes(query)) score = Math.max(score, 60);

    if (queryTokens.length > 0) {
      const valueTokens = new Set(significantTokens(value));
      const matches = queryTokens.filter((token) => valueTokens.has(token));
      if (matches.length === queryTokens.length) {
        score = Math.max(score, 45 + matches.length * 5);
      } else {
        score = Math.max(score, matches.length * 10);
      }
    }
  }

  return score;
};

export const searchZimbabweInstitutions = (
  query?: string,
): ZimbabweTertiaryInstitution[] => {
  const normalizedQuery = normalizeInstitutionText(query);

  if (!normalizedQuery) {
    return [...ZIMBABWE_TERTIARY_INSTITUTIONS];
  }

  return ZIMBABWE_TERTIARY_INSTITUTIONS.map((item) => ({
    item,
    score: scoreInstitutionSearch(item, normalizedQuery),
  }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.item.name.localeCompare(right.item.name),
    )
    .map(({ item }) => item);
};