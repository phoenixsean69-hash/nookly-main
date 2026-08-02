import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "lib",
  "useAppwrite.ts",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\nRun this script from the Nookly project root.`,
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

const replaceExact = (
  oldBlock,
  newBlock,
  label,
) => {
  if (!updated.includes(oldBlock)) {
    throw new Error(
      `Could not locate ${label}. No changes were written.`,
    );
  }

  updated = updated.replace(oldBlock, newBlock);
};

// ---------------------------------------------------------------------------
// 1. Move dataRef creation until after the query's namespace/key are known.
// ---------------------------------------------------------------------------
replaceExact(
`  const isMounted = useRef(true);
  const paramsRef = useRef(params);
  const fnRef = useRef(fn);
  const dataRef = useRef<T | null>(null);
  const changeRefreshTimerRef =
`,
`  const isMounted = useRef(true);
  const paramsRef = useRef(params);
  const fnRef = useRef(fn);
  const changeRefreshTimerRef =
`,
"the original dataRef declaration",
);

// ---------------------------------------------------------------------------
// 2. Create the full memory key and synchronously restore cached data.
// ---------------------------------------------------------------------------
const logicalKeyBlock = `  const logicalKey = useMemo(() => {
    if (cacheKey) return cacheKey;

    const fnName = fn.name || "query";
    return \`\${fnName}_\${paramsSignature}\`;
  }, [cacheKey, fn.name, paramsSignature]);

`;

const synchronousCacheBlock = `${logicalKeyBlock}  const memoryKey = useMemo(
    () => \`\${namespace}:\${logicalKey}\`,
    [logicalKey, namespace],
  );

  const initialMemoryEntry = useMemo(
    () =>
      memoryCache.get(memoryKey) as
        | MemoryCacheEntry<T>
        | undefined,
    [memoryKey],
  );

  const dataRef = useRef<T | null>(
    initialMemoryEntry?.data ?? null,
  );
  const activeMemoryKeyRef = useRef(memoryKey);

`;

replaceExact(
  logicalKeyBlock,
  synchronousCacheBlock,
  "the logical query key block",
);

// ---------------------------------------------------------------------------
// 3. Initialize React state from memory instead of null/loading.
// ---------------------------------------------------------------------------
replaceExact(
`  const [data, setData] =
    useState<T | null>(null);
  const [loading, setLoading] =
    useState<boolean>(!skip);
  const [error, setError] =
    useState<string | null>(null);
  const [isOffline, setIsOffline] =
    useState(false);
  const [fromCache, setFromCache] =
    useState(false);

`,
`  const [data, setData] = useState<T | null>(
    () => initialMemoryEntry?.data ?? null,
  );
  const [loading, setLoading] =
    useState<boolean>(
      () => !skip && initialMemoryEntry === undefined,
    );
  const [error, setError] =
    useState<string | null>(null);
  const [isOffline, setIsOffline] =
    useState(false);
  const [fromCache, setFromCache] =
    useState<boolean>(
      () => initialMemoryEntry !== undefined,
    );

  // When the namespace or query key changes, immediately switch to any
  // matching in-memory result before the asynchronous cache/network work.
  useEffect(() => {
    if (activeMemoryKeyRef.current === memoryKey) {
      return;
    }

    activeMemoryKeyRef.current = memoryKey;

    const nextMemoryEntry = memoryCache.get(
      memoryKey,
    ) as MemoryCacheEntry<T> | undefined;

    if (nextMemoryEntry) {
      dataRef.current = nextMemoryEntry.data;
      setData(nextMemoryEntry.data);
      setFromCache(true);
      setLoading(false);
      setError(null);
      return;
    }

    dataRef.current = null;
    setData(null);
    setFromCache(false);
    setLoading(!skip);
  }, [memoryKey, skip]);

`,
"the useAppwrite state initialization block",
);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (updated === original) {
  throw new Error("No changes were made.");
}

if (
  updated.includes(
    "const dataRef = useRef<T | null>(null);",
  )
) {
  throw new Error(
    "Validation failed: null-only dataRef initialization remains.",
  );
}

if (
  updated.includes(
    "useState<T | null>(null);",
  )
) {
  throw new Error(
    "Validation failed: data still initializes from null only.",
  );
}

if (
  !updated.includes(
    "initialMemoryEntry?.data ?? null",
  )
) {
  throw new Error(
    "Validation failed: synchronous memory hydration is missing.",
  );
}

if (
  !updated.includes(
    "activeMemoryKeyRef.current === memoryKey",
  )
) {
  throw new Error(
    "Validation failed: query-key switching support is missing.",
  );
}

if (
  !updated.includes(
    "initialMemoryEntry === undefined",
  )
) {
  throw new Error(
    "Validation failed: cache-aware loading state is missing.",
  );
}

const backupPath = `${targetPath}.step9.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Step 9 applied successfully.");
console.log("Updated: lib/useAppwrite.ts");
console.log("Backup: lib/useAppwrite.ts.step9.bak");
console.log("");
console.log("Cached queries now render from memory on the first frame.");
console.log("Now run: npx tsc --noEmit");
