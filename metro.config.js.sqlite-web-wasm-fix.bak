const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// react-native-appwrite (up to and including v0.34.0) uses the legacy
// expo-file-system API (readAsStringAsync, EncodingType.Base64, etc.) for
// chunked uploads of files larger than 5MB. In expo-file-system v19 (Expo
// SDK 54) that API moved to "expo-file-system/legacy", so large video
// uploads crash with: Cannot read property 'Base64' of undefined.
// Redirect only react-native-appwrite's imports to the legacy entry point.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "expo-file-system" &&
    context.originModulePath.includes("react-native-appwrite")
  ) {
    return context.resolveRequest(context, "expo-file-system/legacy", platform);
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./app/global.css" });