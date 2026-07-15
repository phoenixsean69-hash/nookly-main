import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export async function downloadMediaToDevice(
  uri: string,
  filename: string,
): Promise<void> {
  // Request both photo AND video granular permissions. On Android 13+,
  // requesting only "photo" grants READ_MEDIA_IMAGES but not READ_MEDIA_VIDEO,
  // which makes createAssetAsync route videos into the images MediaStore
  // collection and fail with "MIME type video/mp4 cannot be inserted".
  const { status } = await MediaLibrary.requestPermissionsAsync(false, [
    "photo",
    "video",
  ]);
  if (status !== "granted") {
    throw new Error(
      "Permission to access your photo library was denied. Please enable it in Settings.",
    );
  }

  const destination = new File(Paths.cache, filename);
  const downloadedFile = await File.downloadFileAsync(uri, destination);

  const asset = await MediaLibrary.createAssetAsync(downloadedFile.uri);
  await MediaLibrary.createAlbumAsync("Nookly", asset, false);

  downloadedFile.delete();
}
