#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `text-clipping-v3-${timestamp}`,
);

const OUTPUTS = {
  "app/(root)/(driver)/_layout.tsx": "import icons from \"@/constants/icons\";\nimport { Colors } from \"@/constants/Colors\";\nimport { getUserHomeRoute, isDriverUser } from \"@/lib/userMode\";\nimport useAuthStore from \"@/store/auth.store\";\nimport { Redirect, Tabs } from \"expo-router\";\nimport React from \"react\";\nimport {\n  ActivityIndicator,\n  Image,\n  ImageSourcePropType,\n  Text,\n  View,\n  useColorScheme,\n} from \"react-native\";\n\nconst DriverTabIcon = ({\n  focused,\n  icon,\n  title,\n}: {\n  focused: boolean;\n  icon: ImageSourcePropType;\n  title: string;\n}) => {\n  const colorScheme = useColorScheme();\n  const theme = Colors[colorScheme ?? \"light\"];\n\n  return (\n    <View className=\"relative mt-2 flex-1 flex-col items-center\">\n      <Image\n        source={icon}\n        tintColor={focused ? theme.primary[300] : theme.muted}\n        resizeMode=\"contain\"\n        className=\"size-6\"\n      />\n\n      <Text\n        className={`mt-0 w-full text-center text-xs ${\n          focused ? \"font-rubik-medium\" : \"font-rubik\"\n        }`}\n        style={{\n          color: focused ? theme.primary[300] : theme.text,\n          minWidth: 48,\n          paddingHorizontal: 4,\n        }}\n      >\n        {`${title} `}\n      </Text>\n    </View>\n  );\n};\n\nexport default function DriverTabsLayout() {\n  const colorScheme = useColorScheme();\n  const theme = Colors[colorScheme ?? \"light\"];\n  const { user, isHydrated, isInitialized, isLoading } = useAuthStore();\n\n  if (!isHydrated || !isInitialized || isLoading) {\n    return (\n      <View\n        className=\"flex-1 items-center justify-center\"\n        style={{ backgroundColor: theme.background }}\n      >\n        <ActivityIndicator size=\"large\" color={theme.primary[300]} />\n      </View>\n    );\n  }\n\n  if (!user) {\n    return <Redirect href=\"/sign-in\" />;\n  }\n\n  if (!isDriverUser(user)) {\n    return <Redirect href={getUserHomeRoute(user) as any} />;\n  }\n\n  return (\n    <Tabs\n      screenOptions={{\n        headerShown: false,\n        tabBarShowLabel: false,\n        tabBarItemStyle: {\n          minWidth: 0,\n          paddingHorizontal: 0,\n        },\n        tabBarStyle: {\n          backgroundColor: theme.navBackground,\n          position: \"absolute\",\n          borderTopColor: \"#0061FF1A\",\n          borderTopWidth: 2,\n          minHeight: 80,\n          paddingTop: 0,\n          paddingBottom: 10,\n          overflow: \"visible\",\n        },\n      }}\n    >\n      <Tabs.Screen\n        name=\"driver-home\"\n        options={{\n          title: \"Home\",\n          tabBarIcon: ({ focused }) => (\n            <DriverTabIcon focused={focused} icon={icons.home} title=\"Home\" />\n          ),\n        }}\n      />\n\n      <Tabs.Screen\n        name=\"driver-rides\"\n        options={{\n          title: \"Rides\",\n          tabBarIcon: ({ focused }) => (\n            <DriverTabIcon\n              focused={focused}\n              icon={icons.calendar}\n              title=\"Rides\"\n            />\n          ),\n        }}\n      />\n\n      <Tabs.Screen\n        name=\"driver-active\"\n        options={{\n          title: \"Active\",\n          tabBarIcon: ({ focused }) => (\n            <DriverTabIcon\n              focused={focused}\n              icon={icons.location}\n              title=\"Active\"\n            />\n          ),\n        }}\n      />\n\n      <Tabs.Screen\n        name=\"driver-profile\"\n        options={{\n          title: \"Profile\",\n          tabBarIcon: ({ focused }) => (\n            <DriverTabIcon\n              focused={focused}\n              icon={icons.person}\n              title=\"Profile\"\n            />\n          ),\n        }}\n      />\n\n      <Tabs.Screen\n        name=\"driver-ride-details\"\n        options={{\n          href: null,\n          headerShown: false,\n        }}\n      />\n    </Tabs>\n  );\n}\n",
  "plugins/fix-android-text-clipping.cjs": "/**\n * React Native 0.81 Android text clipping workaround.\n *\n * Android can measure Text slightly too narrowly and clip the final glyph.\n * A NORMAL trailing space is required. Thin spaces and zero-width characters\n * can be ignored by Android's visual-bound measurement.\n *\n * Only outer React Native Text nodes are changed. Nested Text spans are skipped\n * to avoid disturbing inline formatting.\n */\n\nmodule.exports = function nooklyAndroidTextClippingFix({ types: t }) {\n  const stateKey = \"__nooklyAndroidTextFix\";\n\n  const getJsxName = (node) => {\n    if (t.isJSXIdentifier(node)) return node.name;\n    return null;\n  };\n\n  const isMatchingTextElement = (path, textNames) => {\n    if (!path.isJSXElement()) return false;\n\n    const name = getJsxName(path.node.openingElement.name);\n    return Boolean(name && textNames.has(name));\n  };\n\n  return {\n    name: \"nookly-android-text-clipping-fix\",\n\n    visitor: {\n      Program: {\n        enter(programPath, state) {\n          const filename = state.filename || \"\";\n\n          if (filename.includes(\"node_modules\")) {\n            state[stateKey] = null;\n            return;\n          }\n\n          const textNames = new Set();\n          let reactNativeImportPath = null;\n          let platformLocalName = null;\n\n          for (const childPath of programPath.get(\"body\")) {\n            if (!childPath.isImportDeclaration()) continue;\n            if (childPath.node.source.value !== \"react-native\") continue;\n\n            reactNativeImportPath ||= childPath;\n\n            for (const specifier of childPath.node.specifiers) {\n              if (!t.isImportSpecifier(specifier)) continue;\n\n              const importedName = t.isIdentifier(specifier.imported)\n                ? specifier.imported.name\n                : specifier.imported.value;\n\n              if (importedName === \"Text\") {\n                textNames.add(specifier.local.name);\n              }\n\n              if (importedName === \"Platform\") {\n                platformLocalName = specifier.local.name;\n              }\n            }\n          }\n\n          if (textNames.size === 0 || !reactNativeImportPath) {\n            state[stateKey] = null;\n            return;\n          }\n\n          if (!platformLocalName) {\n            const platformIdentifier =\n              programPath.scope.generateUidIdentifier(\"NooklyPlatform\");\n\n            reactNativeImportPath.node.specifiers.push(\n              t.importSpecifier(\n                platformIdentifier,\n                t.identifier(\"Platform\"),\n              ),\n            );\n\n            platformLocalName = platformIdentifier.name;\n          }\n\n          state[stateKey] = {\n            textNames,\n            platformLocalName,\n          };\n        },\n      },\n\n      JSXElement(path, state) {\n        const config = state[stateKey];\n        if (!config) return;\n\n        const { textNames, platformLocalName } = config;\n\n        if (!isMatchingTextElement(path, textNames)) return;\n\n        const nestedInsideText = Boolean(\n          path.findParent((parentPath) =>\n            isMatchingTextElement(parentPath, textNames),\n          ),\n        );\n\n        if (nestedInsideText) return;\n\n        path.node.children.push(\n          t.jsxExpressionContainer(\n            t.conditionalExpression(\n              t.binaryExpression(\n                \"===\",\n                t.memberExpression(\n                  t.identifier(platformLocalName),\n                  t.identifier(\"OS\"),\n                ),\n                t.stringLiteral(\"android\"),\n              ),\n              t.stringLiteral(\" \"),\n              t.stringLiteral(\"\"),\n            ),\n          ),\n        );\n      },\n    },\n  };\n};\n",
};

async function main() {
  console.log("\nInstalling Nookly text clipping hotfix v3...\n");

  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );

  const reactNativeVersion =
    packageJson.dependencies?.["react-native"] || "";

  if (!reactNativeVersion.includes("0.81")) {
    throw new Error(
      `Expected React Native 0.81.x, found "${reactNativeVersion}".`,
    );
  }

  for (const relativePath of Object.keys(OUTPUTS)) {
    const source = path.join(root, relativePath);
    const backup = path.join(backupRoot, relativePath);

    await mkdir(path.dirname(backup), { recursive: true });
    await cp(source, backup);
  }

  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  for (const [relativePath, content] of Object.entries(OUTPUTS)) {
    const destination = path.join(root, relativePath);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");

    console.log(`✓ Installed ${relativePath}`);
  }

  console.log("\n✓ Replaced thin spacer with a normal trailing space.");
  console.log("✓ Removed clipping/ellipsis from driver tab labels.");
  console.log("✓ Added direct trailing space and minimum label width.");

  console.log("\nRun:");
  console.log('node --check "plugins/fix-android-text-clipping.cjs"');
  console.log('npx eslint "app/(root)/(driver)/_layout.tsx"');
}

main().catch((error) => {
  console.error("\n✗ Installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
