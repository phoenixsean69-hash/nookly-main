/**
 * Expo-compatible workaround for React Native 0.81 Android text clipping.
 *
 * React Native 0.81 can measure a Text node one pixel too narrowly on some
 * Android versions/devices. Appending a very thin trailing spacer forces the
 * native paragraph width to include the final glyph.
 *
 * Only outer React Native <Text> elements are changed. Nested Text spans are
 * deliberately skipped so punctuation and inline emphasis keep their spacing.
 */

module.exports = function nooklyAndroidTextClippingFix({ types: t }) {
  const stateKey = "__nooklyAndroidTextFix";

  const getJsxName = (node) => {
    if (t.isJSXIdentifier(node)) return node.name;
    return null;
  };

  const isMatchingTextElement = (path, textNames) => {
    if (!path.isJSXElement()) return false;

    const name = getJsxName(path.node.openingElement.name);
    return Boolean(name && textNames.has(name));
  };

  return {
    name: "nookly-android-text-clipping-fix",

    visitor: {
      Program: {
        enter(programPath, state) {
          const filename = state.filename || "";

          if (filename.includes("node_modules")) {
            state[stateKey] = null;
            return;
          }

          const textNames = new Set();
          let reactNativeImportPath = null;
          let platformLocalName = null;

          for (const childPath of programPath.get("body")) {
            if (!childPath.isImportDeclaration()) continue;
            if (childPath.node.source.value !== "react-native") continue;

            reactNativeImportPath ||= childPath;

            for (const specifier of childPath.node.specifiers) {
              if (!t.isImportSpecifier(specifier)) continue;

              const importedName = t.isIdentifier(specifier.imported)
                ? specifier.imported.name
                : specifier.imported.value;

              if (importedName === "Text") {
                textNames.add(specifier.local.name);
              }

              if (importedName === "Platform") {
                platformLocalName = specifier.local.name;
              }
            }
          }

          if (textNames.size === 0 || !reactNativeImportPath) {
            state[stateKey] = null;
            return;
          }

          if (!platformLocalName) {
            const platformIdentifier =
              programPath.scope.generateUidIdentifier("NooklyPlatform");

            reactNativeImportPath.node.specifiers.push(
              t.importSpecifier(
                platformIdentifier,
                t.identifier("Platform"),
              ),
            );

            platformLocalName = platformIdentifier.name;
          }

          state[stateKey] = {
            textNames,
            platformLocalName,
          };
        },
      },

      JSXElement(path, state) {
        const config = state[stateKey];
        if (!config) return;

        const { textNames, platformLocalName } = config;

        if (!isMatchingTextElement(path, textNames)) return;

        const nestedInsideText = Boolean(
          path.findParent((parentPath) =>
            isMatchingTextElement(parentPath, textNames),
          ),
        );

        if (nestedInsideText) return;

        const spacerExpression = t.jsxExpressionContainer(
          t.conditionalExpression(
            t.binaryExpression(
              "===",
              t.memberExpression(
                t.identifier(platformLocalName),
                t.identifier("OS"),
              ),
              t.stringLiteral("android"),
            ),
            t.stringLiteral("\u2009"),
            t.stringLiteral(""),
          ),
        );

        path.node.children.push(spacerExpression);
      },
    },
  };
};
