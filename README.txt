NOOKLY — IN-BUILT LEASE PDF VIEWER

CHANGES

1. Preview downloads the PDF into the app cache first.
2. The local device file opens in a Nookly PDF viewer.
3. The viewer supports:
   - vertical scrolling
   - pinch zoom
   - double-tap zoom
   - page number and total pages
   - download from the viewer header
4. Android Download saves directly into the normal Downloads collection.
5. No Storage Access Framework directory picker is used.
6. No external PDF application or browser is opened.

EXPO 54 NATIVE DEPENDENCIES

react-native-pdf: 6.7.7
react-native-blob-util: 0.21.2
@config-plugins/react-native-pdf: 12.0.0
@config-plugins/react-native-blob-util: 12.0.0

APPLY

Extract the whole ZIP into the Nookly project root.

Run:

node .\apply-inbuilt-lease-pdf-viewer.mjs

Then:

npm install
npx tsc --noEmit

IMPORTANT

react-native-pdf contains native code. Expo Go and an old APK cannot load it.
After TypeScript is clean, create a new development/APK build.
