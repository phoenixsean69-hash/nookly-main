import { compress, probe } from "@bsky.app/video-compressor";
import { File as ExpoFile } from "expo-file-system";

export const PROPERTY_VIDEO_POLICY = {
  minimumVideos: 2,
  maximumVideos: 3,
  maximumDurationSeconds: 90,
  maximumSourceBytes: 500 * 1024 * 1024,
  maximumOutputBytes: 18 * 1024 * 1024,
  targetVideoBitrate: 1_000_000,
  maximumLongEdge: 1280,
  maximumFrameRate: 30,
  outputMimeType: "video/mp4",
  outputExtension: "mp4",
} as const;

const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm"]);
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
]);

export type PropertyVideoSource = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null; // expo-image-picker: milliseconds
};

export type PropertyVideoInspection = {
  uri: string;
  fileName: string;
  mimeType: string;
  extension: string;
  sourceBytes: number;
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number | null;
  bitrate: number | null;
  codec: string | null;
  rotation: number | null;
};

export type CompressedPropertyVideo = {
  uri: string;
  fileName: string;
  mimeType: "video/mp4";
  fileSize: number;
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  sourceBytes: number;
  compressionRatio: number;
  passthroughReason?: string | null;
};

const getExtension = (fileName?: string | null, uri?: string): string => {
  const nameMatch = String(fileName ?? "").split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  if (nameMatch?.[1]) return nameMatch[1].toLowerCase();
  const uriMatch = String(uri ?? "").split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  return uriMatch?.[1]?.toLowerCase() ?? "";
};

const normalizeMimeType = (value?: string | null): string =>
  String(value ?? "").split(";")[0].trim().toLowerCase();

const getSourceSize = (source: PropertyVideoSource): number => {
  const supplied = Number(source.fileSize ?? 0);
  if (Number.isFinite(supplied) && supplied > 0) return supplied;

  const localFile = new ExpoFile(source.uri);
  const size = Number(localFile.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Could not determine the selected video's file size.");
  }
  return size;
};

const pickerDurationSeconds = (source: PropertyVideoSource): number | null => {
  const ms = Number(source.duration ?? 0);
  return Number.isFinite(ms) && ms > 0 ? ms / 1000 : null;
};

const numberOrNull = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const stringOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text || null;
};

const assertDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("The selected video has an invalid duration.");
  }
  if (seconds > PROPERTY_VIDEO_POLICY.maximumDurationSeconds) {
    throw new Error(
      `Verification videos must be ${PROPERTY_VIDEO_POLICY.maximumDurationSeconds} seconds or shorter.`,
    );
  }
};

const assertSourceSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error("The selected video is empty or unavailable.");
  }
  if (bytes > PROPERTY_VIDEO_POLICY.maximumSourceBytes) {
    throw new Error("The source video is larger than Nookly's 500 MB processing limit.");
  }
};

const assertSourceFormat = (source: PropertyVideoSource) => {
  const extension = getExtension(source.fileName, source.uri);
  const mimeType = normalizeMimeType(source.mimeType);

  if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported video format. Choose an MP4, MOV, M4V, or WebM video.");
  }

  return {
    extension:
      extension ||
      (mimeType === "video/quicktime"
        ? "mov"
        : mimeType === "video/webm"
          ? "webm"
          : mimeType === "video/x-m4v"
            ? "m4v"
            : "mp4"),
    mimeType:
      mimeType ||
      (extension === "mov"
        ? "video/quicktime"
        : extension === "webm"
          ? "video/webm"
          : extension === "m4v"
            ? "video/x-m4v"
            : "video/mp4"),
  };
};

export const inspectPropertyVideo = async (
  source: PropertyVideoSource,
): Promise<PropertyVideoInspection> => {
  if (!source?.uri?.trim()) {
    throw new Error("The selected video is unavailable.");
  }

  const { extension, mimeType } = assertSourceFormat(source);
  const sourceBytes = getSourceSize(source);
  assertSourceSize(sourceBytes);

  const pickerSeconds = pickerDurationSeconds(source);
  if (pickerSeconds) assertDuration(pickerSeconds);

  let metadata: Record<string, unknown>;
  try {
    metadata = (await probe(source.uri)) as unknown as Record<string, unknown>;
  } catch (error: any) {
    throw new Error(
      error?.message
        ? `Nookly could not inspect this video: ${error.message}`
        : "Nookly could not inspect this video. Choose another file.",
    );
  }

  const probedDuration = numberOrNull(metadata.duration);
  const durationSeconds =
    probedDuration && probedDuration > 0
      ? probedDuration
      : pickerSeconds;

  if (!durationSeconds) {
    throw new Error("Nookly could not determine this video's duration.");
  }
  assertDuration(durationSeconds);

  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error("Nookly could not determine this video's resolution.");
  }

  return {
    uri: source.uri,
    fileName: source.fileName?.trim() || `property-video.${extension}`,
    mimeType,
    extension,
    sourceBytes,
    durationSeconds,
    width,
    height,
    frameRate: numberOrNull(metadata.frameRate),
    bitrate: numberOrNull(metadata.bitrate),
    codec: stringOrNull(metadata.codec),
    rotation: numberOrNull(metadata.rotation),
  };
};

const verifyCompressedOutput = (
  result: Record<string, unknown>,
  sourceBytes: number,
): CompressedPropertyVideo => {
  const uri = String(result.uri ?? "").trim();
  const reportedSize = Number(result.size ?? 0);
  const mimeType = normalizeMimeType(String(result.mimeType ?? ""));
  const codec = String(result.codec ?? "").trim().toLowerCase();
  const durationSeconds = Number(result.duration ?? 0);
  const width = Number(result.width ?? 0);
  const height = Number(result.height ?? 0);
  const passthroughReason = result.passthroughReason
    ? String(result.passthroughReason)
    : null;

  if (!uri) throw new Error("Video compression did not produce an output file.");

  const localFile = new ExpoFile(uri);
  const actualSize = Number(localFile.size ?? reportedSize);
  if (!Number.isFinite(actualSize) || actualSize <= 0) {
    throw new Error("Nookly could not verify the compressed video file.");
  }
  if (actualSize > PROPERTY_VIDEO_POLICY.maximumOutputBytes) {
    throw new Error(
      "The compressed video is still larger than 18 MB. Please choose a shorter or simpler video.",
    );
  }

  if (mimeType && mimeType !== PROPERTY_VIDEO_POLICY.outputMimeType) {
    throw new Error(`Compression produced ${mimeType} instead of MP4.`);
  }

  if (codec && !["h264", "avc", "avc1"].includes(codec)) {
    throw new Error(`Compression produced ${codec} instead of H.264.`);
  }

  assertDuration(durationSeconds);

  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error("Nookly could not verify the compressed video's resolution.");
  }
  if (Math.max(width, height) > PROPERTY_VIDEO_POLICY.maximumLongEdge) {
    throw new Error("The compressed video exceeds Nookly's 720p video envelope.");
  }

  return {
    uri,
    fileName: `property-video-${Date.now()}.mp4`,
    mimeType: "video/mp4",
    fileSize: actualSize,
    durationSeconds,
    width,
    height,
    codec: codec || "h264",
    sourceBytes,
    compressionRatio: sourceBytes > 0 ? actualSize / sourceBytes : 1,
    passthroughReason,
  };
};

export const compressPropertyVideo = async (
  source: PropertyVideoSource,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<CompressedPropertyVideo> => {
  const inspection = await inspectPropertyVideo(source);
  options.onProgress?.(0);

  const result = await compress(
    source.uri,
    {
      targetBitrate: PROPERTY_VIDEO_POLICY.targetVideoBitrate,
      maxSize: PROPERTY_VIDEO_POLICY.maximumLongEdge,
      codec: "h264",
      frameRateCap: PROPERTY_VIDEO_POLICY.maximumFrameRate,
      passthroughBelowBytes: 0,
    },
    {
      onProgress: (progress) => {
        options.onProgress?.(Math.max(0, Math.min(1, Number(progress) || 0)));
      },
      signal: options.signal,
    },
  );

  const output = verifyCompressedOutput(
    result as unknown as Record<string, unknown>,
    inspection.sourceBytes,
  );

  options.onProgress?.(1);
  return output;
};

export const formatPropertyVideoBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatPropertyVideoDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const rounded = Math.ceil(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};
