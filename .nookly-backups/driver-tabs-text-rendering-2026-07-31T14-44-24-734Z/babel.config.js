module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      require.resolve("./plugins/fix-android-text-clipping.cjs"),
      "react-native-reanimated/plugin", // This plugin must remain last.
    ],
  };
};
