import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@nookly:persistent-query:v1";
const PROPERTY_ENTITY_PREFIX = "@nookly:property-entity:v1";

export interface PersistentCacheEntry<T> {
  data: T;
  savedAt: number;
}

const normalizeNamespace = (namespace?: string | null): string =>
  String(namespace || "anonymous").trim() || "anonymous";

const hashText = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const namespaceHash = (namespace?: string | null): string =>
  hashText(normalizeNamespace(namespace));

const getQueryStorageKey = (
  logicalKey: string,
  namespace?: string | null,
): string =>
  `${CACHE_PREFIX}:${namespaceHash(namespace)}:${hashText(logicalKey)}`;

const getPropertyStorageKey = (
  propertyId: string,
  namespace?: string | null,
): string =>
  `${PROPERTY_ENTITY_PREFIX}:${namespaceHash(namespace)}:${propertyId}`;

export const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;

    if (seen.has(input as object)) return "[Circular]";
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map(normalize);
    }

    return Object.keys(input as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const field = (input as Record<string, unknown>)[key];

        if (field !== undefined && typeof field !== "function") {
          result[key] = normalize(field);
        }

        return result;
      }, {});
  };

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value);
  }
};

export const readPersistentQueryCache = async <T>(
  logicalKey: string,
  namespace?: string | null,
): Promise<PersistentCacheEntry<T> | null> => {
  try {
    const raw = await AsyncStorage.getItem(
      getQueryStorageKey(logicalKey, namespace),
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistentCacheEntry<T>;

    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Object.prototype.hasOwnProperty.call(parsed, "data")
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Could not read persistent query cache:", error);
    return null;
  }
};

const looksLikeProperty = (
  value: unknown,
): value is Record<string, unknown> & { $id: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const object = value as Record<string, unknown>;
  const id = object.$id ?? object.id;

  if (typeof id !== "string" || !id.trim()) return false;

  return Boolean(
    object.propertyName !== undefined ||
      object.address !== undefined ||
      (object.type !== undefined && object.price !== undefined),
  );
};

const collectPropertyDocuments = (
  value: unknown,
  output: Array<Record<string, unknown> & { $id: string }>,
  depth = 0,
  seen = new WeakSet<object>(),
): void => {
  if (depth > 4 || value === null || typeof value !== "object") return;

  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (looksLikeProperty(value)) {
    const property = value as Record<string, unknown>;
    output.push({
      ...property,
      $id: String(property.$id ?? property.id),
    } as Record<string, unknown> & { $id: string });
  }

  if (Array.isArray(value)) {
    value.forEach((entry) =>
      collectPropertyDocuments(entry, output, depth + 1, seen),
    );
    return;
  }

  const object = value as Record<string, unknown>;

  if (Array.isArray(object.documents)) {
    collectPropertyDocuments(object.documents, output, depth + 1, seen);
  }
};

export const cachePropertyEntities = async (
  value: unknown,
  namespace?: string | null,
): Promise<void> => {
  try {
    const properties: Array<Record<string, unknown> & { $id: string }> = [];
    collectPropertyDocuments(value, properties);

    if (properties.length === 0) return;

    const savedAt = Date.now();
    const uniqueProperties = new Map<string, Record<string, unknown>>();

    properties.forEach((property) => {
      uniqueProperties.set(property.$id, property);
    });

    await AsyncStorage.multiSet(
      Array.from(uniqueProperties.entries()).map(([propertyId, property]) => [
        getPropertyStorageKey(propertyId, namespace),
        JSON.stringify({
          data: property,
          savedAt,
        } satisfies PersistentCacheEntry<Record<string, unknown>>),
      ]),
    );
  } catch (error) {
    console.warn("Could not cache property entities:", error);
  }
};

export const writePersistentQueryCache = async <T>(
  logicalKey: string,
  data: T,
  namespace?: string | null,
): Promise<void> => {
  try {
    const entry: PersistentCacheEntry<T> = {
      data,
      savedAt: Date.now(),
    };

    await AsyncStorage.setItem(
      getQueryStorageKey(logicalKey, namespace),
      JSON.stringify(entry),
    );

    await cachePropertyEntities(data, namespace);
  } catch (error) {
    console.warn("Could not write persistent query cache:", error);
  }
};

export const readCachedPropertyEntity = async <T>(
  propertyId: string,
  namespace?: string | null,
): Promise<PersistentCacheEntry<T> | null> => {
  if (!propertyId?.trim()) return null;

  try {
    const raw = await AsyncStorage.getItem(
      getPropertyStorageKey(propertyId, namespace),
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistentCacheEntry<T>;

    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Object.prototype.hasOwnProperty.call(parsed, "data")
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Could not read cached property:", error);
    return null;
  }
};

export const clearPersistentQueryCache = async (
  namespace?: string | null,
): Promise<void> => {
  try {
    const scope = namespaceHash(namespace);
    const queryPrefix = `${CACHE_PREFIX}:${scope}:`;
    const propertyPrefix = `${PROPERTY_ENTITY_PREFIX}:${scope}:`;
    const keys = await AsyncStorage.getAllKeys();
    const scopedKeys = keys.filter(
      (key) => key.startsWith(queryPrefix) || key.startsWith(propertyPrefix),
    );

    if (scopedKeys.length > 0) {
      await AsyncStorage.multiRemove(scopedKeys);
    }
  } catch (error) {
    console.warn("Could not clear persistent query cache:", error);
  }
};
