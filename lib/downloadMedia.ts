import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export async function downloadMediaToDevice(
  uri: string,
  filename: string,
): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
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