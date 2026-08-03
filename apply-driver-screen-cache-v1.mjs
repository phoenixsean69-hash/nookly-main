import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  home: path.join(root, "app", "(root)", "(driver)", "driver-home.tsx"),
  active: path.join(root, "app", "(root)", "(driver)", "driver-active.tsx"),
  profile: path.join(root, "app", "(root)", "(driver)", "driver-profile.tsx"),
  cache: path.join(root, "lib", "profilePageCache.ts"),
};

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const requireFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
};

const backup = (filePath) => {
  const backupPath = `${filePath}.driver-screen-cache-v1.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const insertBeforeRequired = (source, marker, insertion, label) => {
  if (source.includes(insertion.trim())) return source;

  const index = source.indexOf(marker);
  if (index < 0) fail(`Could not find ${label}.`);

  return source.slice(0, index) + insertion + source.slice(index);
};

const replaceRequired = (source, search, replacement, label) => {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) fail(`Could not find ${label}.`);
  return source.replace(search, replacement);
};

const addReactNamedImport = (source, name) => {
  const pattern = /import React,\s*\{([\s\S]*?)\}\s*from "react";/;
  const match = source.match(pattern);

  if (!match) fail("the React named import");

  const names = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (names.includes(name)) return source;

  names.push(name);

  return source.replace(
    match[0],
    `import React, {\n  ${names.sort().join(",\n  ")},\n} from "react";`,
  );
};

Object.entries(files).forEach(([label, filePath]) => {
  requireFile(filePath, label);
});

[files.home, files.active, files.profile].forEach(backup);

// ---------------------------------------------------------------------------
// Driver Home / Dashboard cache.
// ---------------------------------------------------------------------------

let home = fs.readFileSync(files.home, "utf8");

home = addReactNamedImport(home, "useRef");

home = insertBeforeRequired(
  home,
  'import useAuthStore from "@/store/auth.store";',
  `import {\n  mergeProfilePageCache,\n  peekProfilePageCache,\n  readProfilePageCache,\n  writeProfilePageCache,\n} from "@/lib/profilePageCache";\n`,
  "the Driver Home auth import",
);

home = insertBeforeRequired(
  home,
  "export default function DriverHomeScreen()",
  `interface DriverHomeCacheSnapshot {\n  dashboard: DriverDashboard | null;\n  error: string | null;\n}\n\nconst DRIVER_HOME_CACHE_KEY = "driver-home-dashboard";\n\n`,
  "the Driver Home component",
);

home = replaceRequired(
  home,
  `  const user = useAuthStore((state) => state.user);\n\n  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);\n  const [loading, setLoading] = useState(true);`,
  `  const user = useAuthStore((state) => state.user);\n  const accountId = user?.accountId || "";\n  const initialHomeCache =\n    peekProfilePageCache<DriverHomeCacheSnapshot>(\n      accountId,\n      DRIVER_HOME_CACHE_KEY,\n    );\n\n  const [dashboard, setDashboard] = useState<DriverDashboard | null>(\n    () => initialHomeCache?.dashboard ?? null,\n  );\n  const [loading, setLoading] = useState(\n    () => !initialHomeCache?.dashboard,\n  );`,
  "the Driver Home dashboard state",
);

home = replaceRequired(
  home,
  `  const [error, setError] = useState<string | null>(null);\n  const [avatarFailed, setAvatarFailed] = useState(false);`,
  `  const [error, setError] = useState<string | null>(\n    () => initialHomeCache?.error ?? null,\n  );\n  const [avatarFailed, setAvatarFailed] = useState(false);\n  const dashboardAvailableRef = useRef(\n    Boolean(initialHomeCache?.dashboard),\n  );\n  const networkLoadFinishedRef = useRef(false);`,
  "the Driver Home error state",
);

home = insertBeforeRequired(
  home,
  "  const loadDashboard = useCallback(async (refresh = false) => {",
  `  useEffect(() => {\n    let active = true;\n\n    if (!accountId) {\n      return () => {\n        active = false;\n      };\n    }\n\n    void readProfilePageCache<DriverHomeCacheSnapshot>(\n      accountId,\n      DRIVER_HOME_CACHE_KEY,\n    ).then((snapshot) => {\n      if (\n        !active ||\n        !snapshot ||\n        networkLoadFinishedRef.current\n      ) {\n        return;\n      }\n\n      if (snapshot.dashboard) {\n        dashboardAvailableRef.current = true;\n        setDashboard(snapshot.dashboard);\n      }\n\n      setError(snapshot.error ?? null);\n      setLoading(false);\n    });\n\n    return () => {\n      active = false;\n    };\n  }, [accountId]);\n\n`,
  "the Driver Home loadDashboard function",
);

home = replaceRequired(
  home,
  `    if (refresh) {\n      setRefreshing(true);\n    } else {\n      setLoading(true);\n    }`,
  `    if (refresh) {\n      setRefreshing(true);\n    } else if (!dashboardAvailableRef.current) {\n      setLoading(true);\n    }`,
  "the Driver Home loading behavior",
);

home = replaceRequired(
  home,
  `    try {\n      setDashboard(await getDriverDashboard());\n    } catch (caughtError) {\n      setError(\n        caughtError instanceof Error\n          ? caughtError.message\n          : "Could not load your driver dashboard.",\n      );`,
  `    try {\n      const nextDashboard = await getDriverDashboard();\n\n      networkLoadFinishedRef.current = true;\n      dashboardAvailableRef.current = true;\n      setDashboard(nextDashboard);\n      setError(null);\n\n      if (accountId) {\n        void writeProfilePageCache<DriverHomeCacheSnapshot>(\n          accountId,\n          DRIVER_HOME_CACHE_KEY,\n          {\n            dashboard: nextDashboard,\n            error: null,\n          },\n        );\n      }\n    } catch (caughtError) {\n      const message =\n        caughtError instanceof Error\n          ? caughtError.message\n          : "Could not load your driver dashboard.";\n\n      setError(message);\n\n      if (accountId) {\n        void mergeProfilePageCache<DriverHomeCacheSnapshot>(\n          accountId,\n          DRIVER_HOME_CACHE_KEY,\n          { error: message },\n        );\n      }`,
  "the Driver Home API result handling",
);

const homeLoadStart = home.indexOf(
  "  const loadDashboard = useCallback(async (refresh = false) => {",
);
const homeFocusMarker = "\n\n  useFocusEffect(";
const homeLoadEnd = home.indexOf(homeFocusMarker, homeLoadStart);

if (homeLoadStart < 0 || homeLoadEnd < 0) {
  fail("Could not isolate the Driver Home loadDashboard callback.");
}

let homeLoadBlock = home.slice(homeLoadStart, homeLoadEnd);
homeLoadBlock = homeLoadBlock.replace(/\}, \[\]\);\s*$/, "}, [accountId]);");
home =
  home.slice(0, homeLoadStart) +
  homeLoadBlock +
  home.slice(homeLoadEnd);

home = replaceRequired(
  home,
  `    setDashboard({\n      ...dashboard,\n      profile: {\n        ...dashboard.profile,\n        isOnline: value,\n      },\n    });\n    setAvailabilityLoading(true);`,
  `    const nextDashboard: DriverDashboard = {\n      ...dashboard,\n      profile: {\n        ...dashboard.profile,\n        isOnline: value,\n      },\n    };\n\n    setDashboard(nextDashboard);\n    setAvailabilityLoading(true);\n\n    if (accountId) {\n      void mergeProfilePageCache<DriverHomeCacheSnapshot>(\n        accountId,\n        DRIVER_HOME_CACHE_KEY,\n        { dashboard: nextDashboard },\n      );\n    }`,
  "the Driver Home optimistic availability update",
);

home = replaceRequired(
  home,
  `      setDashboard({\n        ...dashboard,\n        profile: {\n          ...dashboard.profile,\n          isOnline: previousValue,\n        },\n      });\n\n      setError(`,
  `      const restoredDashboard: DriverDashboard = {\n        ...dashboard,\n        profile: {\n          ...dashboard.profile,\n          isOnline: previousValue,\n        },\n      };\n\n      setDashboard(restoredDashboard);\n\n      if (accountId) {\n        void mergeProfilePageCache<DriverHomeCacheSnapshot>(\n          accountId,\n          DRIVER_HOME_CACHE_KEY,\n          { dashboard: restoredDashboard },\n        );\n      }\n\n      setError(`,
  "the Driver Home availability rollback",
);

fs.writeFileSync(files.home, home, "utf8");

// ---------------------------------------------------------------------------
// Active Ride cache.
// ---------------------------------------------------------------------------

let active = fs.readFileSync(files.active, "utf8");

active = insertBeforeRequired(
  active,
  'import type {\n  DriverDashboard,',
  `import {\n  peekProfilePageCache,\n  readProfilePageCache,\n  writeProfilePageCache,\n} from "@/lib/profilePageCache";\nimport useAuthStore from "@/store/auth.store";\n`,
  "the Active Ride driver type import",
);

active = insertBeforeRequired(
  active,
  "export default function DriverActiveRideScreen()",
  `interface DriverActiveCacheSnapshot {\n  dashboard: DriverDashboard | null;\n  rideDetails: DriverRideDetails | null;\n  driverCoordinate: DriverCoordinate | null;\n  lastLocationAt: string | null;\n}\n\nconst DRIVER_ACTIVE_CACHE_KEY = "driver-active-ride";\n\n`,
  "the Active Ride component",
);

active = replaceRequired(
  active,
  `  const colorScheme = useColorScheme();\n  const theme = Colors[colorScheme ?? "light"];\n  const safeAreaInsets = useSafeAreaInsets();\n  const tabBarHeight = useBottomTabBarHeight();\n\n  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);\n  const [rideDetails, setRideDetails] = useState<DriverRideDetails | null>(\n    null,\n  );\n  const [loading, setLoading] = useState(true);`,
  `  const colorScheme = useColorScheme();\n  const theme = Colors[colorScheme ?? "light"];\n  const safeAreaInsets = useSafeAreaInsets();\n  const tabBarHeight = useBottomTabBarHeight();\n  const accountId =\n    useAuthStore((state) => state.user?.accountId) || "";\n  const initialActiveCache =\n    peekProfilePageCache<DriverActiveCacheSnapshot>(\n      accountId,\n      DRIVER_ACTIVE_CACHE_KEY,\n    );\n\n  const [dashboard, setDashboard] = useState<DriverDashboard | null>(\n    () => initialActiveCache?.dashboard ?? null,\n  );\n  const [rideDetails, setRideDetails] = useState<DriverRideDetails | null>(\n    () => initialActiveCache?.rideDetails ?? null,\n  );\n  const [loading, setLoading] = useState(\n    () => !initialActiveCache?.dashboard,\n  );`,
  "the Active Ride initial state",
);

active = replaceRequired(
  active,
  `  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);\n  const [driverCoordinate, setDriverCoordinate] =\n    useState<DriverCoordinate | null>(null);`,
  `  const [lastLocationAt, setLastLocationAt] = useState<string | null>(\n    () => initialActiveCache?.lastLocationAt ?? null,\n  );\n  const [driverCoordinate, setDriverCoordinate] =\n    useState<DriverCoordinate | null>(\n      () => initialActiveCache?.driverCoordinate ?? null,\n    );`,
  "the Active Ride location state",
);

active = replaceRequired(
  active,
  `  const mapWebView = useRef<WebView>(null);`,
  `  const mapWebView = useRef<WebView>(null);\n  const dashboardAvailableRef = useRef(\n    Boolean(initialActiveCache?.dashboard),\n  );\n  const networkLoadFinishedRef = useRef(false);\n  const rideDetailsRef = useRef<DriverRideDetails | null>(\n    initialActiveCache?.rideDetails ?? null,\n  );\n  const activeCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(\n    null,\n  );\n  const lastActiveCacheWriteAtRef = useRef(0);`,
  "the Active Ride refs",
);

const activeLoadStart = active.indexOf(
  "  const loadDashboard = useCallback(async (showLoader = true) => {",
);
const activeLoadEndMarker =
  "\n\n  useEffect(() => {\n    const unsubscribe = NetInfo.addEventListener";
const activeLoadEnd = active.indexOf(activeLoadEndMarker, activeLoadStart);

if (activeLoadStart < 0 || activeLoadEnd < 0) {
  fail("Could not isolate the Active Ride loadDashboard callback.");
}

const activeCacheAndLoad = `  useEffect(() => {\n    rideDetailsRef.current = rideDetails;\n  }, [rideDetails]);\n\n  useEffect(() => {\n    let active = true;\n\n    if (!accountId) {\n      return () => {\n        active = false;\n      };\n    }\n\n    void readProfilePageCache<DriverActiveCacheSnapshot>(\n      accountId,\n      DRIVER_ACTIVE_CACHE_KEY,\n    ).then((snapshot) => {\n      if (\n        !active ||\n        !snapshot ||\n        networkLoadFinishedRef.current\n      ) {\n        return;\n      }\n\n      if (snapshot.dashboard) {\n        dashboardAvailableRef.current = true;\n        setDashboard(snapshot.dashboard);\n      }\n\n      setRideDetails(snapshot.rideDetails ?? null);\n      setDriverCoordinate(snapshot.driverCoordinate ?? null);\n      setLastLocationAt(snapshot.lastLocationAt ?? null);\n      setLoading(false);\n    });\n\n    return () => {\n      active = false;\n    };\n  }, [accountId]);\n\n  const loadDashboard = useCallback(async (showLoader = true) => {\n    if (showLoader && !dashboardAvailableRef.current) {\n      setLoading(true);\n    }\n\n    try {\n      const nextDashboard = await getDriverDashboard();\n      let nextRideDetails: DriverRideDetails | null = null;\n      let nextDriverCoordinate: DriverCoordinate | null = null;\n      let nextLastLocationAt: string | null = null;\n\n      if (nextDashboard.activeRide) {\n        try {\n          nextRideDetails = await getDriverRideDetails(\n            nextDashboard.activeRide.$id,\n          );\n        } catch (detailsError) {\n          console.warn(\n            "Could not load active ride details:",\n            detailsError,\n          );\n\n          if (\n            rideDetailsRef.current?.$id ===\n            nextDashboard.activeRide.$id\n          ) {\n            nextRideDetails = rideDetailsRef.current;\n          }\n        }\n\n        const latitude = nextDashboard.activeRide.currentLatitude;\n        const longitude = nextDashboard.activeRide.currentLongitude;\n\n        if (isFiniteCoordinate(latitude, longitude)) {\n          nextDriverCoordinate = {\n            latitude: Number(latitude),\n            longitude: Number(longitude),\n            heading:\n              nextDashboard.activeRide.currentHeading ?? null,\n            speedKph:\n              nextDashboard.activeRide.currentSpeedKph ?? null,\n            accuracyMeters:\n              nextDashboard.activeRide.currentAccuracyMeters ?? null,\n          };\n          nextLastLocationAt =\n            nextDashboard.activeRide.lastLocationAt ?? null;\n        }\n      }\n\n      networkLoadFinishedRef.current = true;\n      dashboardAvailableRef.current = true;\n      rideDetailsRef.current = nextRideDetails;\n      setDashboard(nextDashboard);\n      setRideDetails(nextRideDetails);\n      setDriverCoordinate(nextDriverCoordinate);\n      setLastLocationAt(nextLastLocationAt);\n\n      if (accountId) {\n        lastActiveCacheWriteAtRef.current = Date.now();\n\n        void writeProfilePageCache<DriverActiveCacheSnapshot>(\n          accountId,\n          DRIVER_ACTIVE_CACHE_KEY,\n          {\n            dashboard: nextDashboard,\n            rideDetails: nextRideDetails,\n            driverCoordinate: nextDriverCoordinate,\n            lastLocationAt: nextLastLocationAt,\n          },\n        );\n      }\n    } catch (caughtError) {\n      if (!dashboardAvailableRef.current) {\n        Alert.alert(\n          "Could not load ride",\n          caughtError instanceof Error\n            ? caughtError.message\n            : "Please try again.",\n        );\n      } else {\n        setLocationMessage(\n          "Showing your last saved ride while Nookly reconnects.",\n        );\n      }\n    } finally {\n      setLoading(false);\n      setRefreshing(false);\n    }\n  }, [accountId]);`;

active =
  active.slice(0, activeLoadStart) +
  activeCacheAndLoad +
  active.slice(activeLoadEnd);

active = insertBeforeRequired(
  active,
  "  const routeCoordinates = useMemo<MapCoordinate[]>(() => {",
  `  useEffect(() => {\n    if (!accountId || !dashboardAvailableRef.current) return;\n\n    if (activeCacheTimerRef.current) {\n      clearTimeout(activeCacheTimerRef.current);\n    }\n\n    const elapsed =\n      Date.now() - lastActiveCacheWriteAtRef.current;\n    const delay = Math.max(0, 30_000 - elapsed);\n\n    activeCacheTimerRef.current = setTimeout(() => {\n      lastActiveCacheWriteAtRef.current = Date.now();\n\n      void writeProfilePageCache<DriverActiveCacheSnapshot>(\n        accountId,\n        DRIVER_ACTIVE_CACHE_KEY,\n        {\n          dashboard,\n          rideDetails,\n          driverCoordinate,\n          lastLocationAt,\n        },\n      );\n    }, delay);\n\n    return () => {\n      if (activeCacheTimerRef.current) {\n        clearTimeout(activeCacheTimerRef.current);\n        activeCacheTimerRef.current = null;\n      }\n    };\n  }, [\n    accountId,\n    dashboard,\n    driverCoordinate,\n    lastLocationAt,\n    rideDetails,\n  ]);\n\n`,
  "the Active Ride route coordinates",
);

fs.writeFileSync(files.active, active, "utf8");

// ---------------------------------------------------------------------------
// Profile is already cached. Validate that the existing persistent profile
// cache remains present so the requested three-screen cache is complete.
// ---------------------------------------------------------------------------

const profile = fs.readFileSync(files.profile, "utf8");

const profileMarkers = [
  "peekProfilePageCache",
  "readProfilePageCache",
  "mergeProfilePageCache",
  "DRIVER_PROFILE_CACHE_KEY",
];

for (const marker of profileMarkers) {
  if (!profile.includes(marker)) {
    fail(
      `Driver Profile cache validation failed: missing ${marker}.`,
    );
  }
}

// Remove extracted patch payloads from the app source tree if present.
const extractedPatchDirectory = path.join(root, "patch-files");
if (fs.existsSync(extractedPatchDirectory)) {
  fs.rmSync(extractedPatchDirectory, {
    recursive: true,
    force: true,
  });
}

console.log(`
Nookly Driver screen cache v1 applied.

Updated:
- app/(root)/(driver)/driver-home.tsx
- app/(root)/(driver)/driver-active.tsx

Validated:
- app/(root)/(driver)/driver-profile.tsx already uses persistent cache

Behaviour:
- Home/Dashboard renders its last successful data immediately.
- Active Ride restores its ride, map data, passengers and last location.
- Profile continues restoring its dashboard and onboarding form.
- All caches are separated by signed-in account ID.
- Each screen refreshes quietly from the working Driver API.
- Cached content remains visible during temporary network failures.
- Active location cache writes are throttled to at most once every 30 seconds.

Next run:
npx tsc --noEmit
`);
