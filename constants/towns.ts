// constants/towns.ts
export const ZIMBABWE_TOWNS = [
  // Major Cities
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Kwekwe",

  // Mashonaland West
  "Kadoma",
  "Chinhoyi",
  "Norton",
  "Chegutu",
  "Karoi",
  "Banket",
  "Raffingora",
  "Mhangura",

  // Mashonaland Central
  "Bindura",
  "Shamva",
  "Mvurwi",
  "Centenary",
  "Mount Darwin",
  "Guruve",

  // Mashonaland East
  "Marondera",
  "Ruwa",
  "Chivhu",
  "Murewa",
  "Macheke",
  "Beatrice",
  "Wedza",

  // Manicaland
  "Rusape",
  "Chipinge",
  "Nyanga",
  "Mutasa",
  "Chimanimani",
  "Buhera",
  "Odzi",

  // Midlands
  "Zvishavane",
  "Shurugwi",
  "Redcliff",
  "Mvuma",
  "Lalapanzi",
  "The Range",
  "Gweru",
  "Kwekwe",

  // Masvingo
  "Masvingo",
  "Chiredzi",
  "Mashava",
  "Ngundu",
  "Triangle",
  "Rutenga",
  "Mbizi",

  // Matabeleland North
  "Hwange",
  "Victoria Falls",
  "Nkayi",
  "Lupane",
  "Tsholotsho",
  "Dete",

  // Matabeleland South
  "Gwanda",
  "Beitbridge",
  "Esigodini",
  "Plumtree",
  "Maphisa",
  "Filabusi",

  // Other Towns
  "Kariba",
  "Gokwe",
  "Epworth",
  "Norton",
  "Chegutu",
];

// Optional: Grouped by province if you need that functionality
export const TOWNS_BY_PROVINCE = {
  Harare: ["Harare", "Chitungwiza", "Epworth", "Ruwa"],
  Bulawayo: ["Bulawayo"],
  Manicaland: [
    "Mutare",
    "Rusape",
    "Chipinge",
    "Nyanga",
    "Mutasa",
    "Chimanimani",
  ],
  Midlands: ["Gweru", "Kwekwe", "Zvishavane", "Shurugwi", "Redcliff", "Mvuma"],
  MashonalandWest: [
    "Kadoma",
    "Chinhoyi",
    "Norton",
    "Chegutu",
    "Karoi",
    "Banket",
  ],
  MashonalandCentral: ["Bindura", "Shamva", "Mvurwi", "Centenary"],
  MashonalandEast: ["Marondera", "Ruwa", "Chivhu", "Murewa", "Macheke"],
  Masvingo: ["Masvingo", "Chiredzi", "Mashava", "Ngundu", "Triangle"],
  MatabelelandNorth: ["Hwange", "Victoria Falls", "Nkayi", "Lupane"],
  MatabelelandSouth: ["Gwanda", "Beitbridge", "Esigodini", "Plumtree"],
  Other: ["Kariba", "Gokwe"],
};

// Function to extract city/town from address
export const extractTownFromAddress = (address: string): string | null => {
  if (!address) return null;

  const addressLower = address.toLowerCase();

  // Check against our towns list
  for (const town of ZIMBABWE_TOWNS) {
    if (addressLower.includes(town.toLowerCase())) {
      return town;
    }
  }

  return null;
};

// If you want just the towns list as a simple array (extracted from above)
export const townsList = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Kwekwe",
  "Kadoma",
  "Chinhoyi",
  "Norton",
  "Chegutu",
  "Karoi",
  "Bindura",
  "Shamva",
  "Marondera",
  "Ruwa",
  "Chivhu",
  "Rusape",
  "Chipinge",
  "Zvishavane",
  "Shurugwi",
  "Redcliff",
  "Masvingo",
  "Chiredzi",
  "Mashava",
  "Hwange",
  "Victoria Falls",
  "Gwanda",
  "Beitbridge",
  "Kariba",
  "Gokwe",
  "Epworth",
  "Nyanga",
  "Mvurwi",
  "Lupane",
  "Plumtree",
  "Triangle",
  "Macheke",
  "Murewa",
  "Banket",
  "Mhangura",
  "Centenary",
  "Mount Darwin",
  "Guruve",
  "Beatrice",
  "Wedza",
  "Mutasa",
  "Chimanimani",
  "Buhera",
  "Odzi",
  "Mvuma",
  "Lalapanzi",
  "The Range",
  "Ngundu",
  "Rutenga",
  "Mbizi",
  "Nkayi",
  "Tsholotsho",
  "Dete",
  "Esigodini",
  "Maphisa",
  "Filabusi",
];
