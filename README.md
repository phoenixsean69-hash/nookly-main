# Nookly Repeat Download TypeScript Fix

This corrects the import corruption introduced by the previous installer and
fixes the `react-native-pdf` activity-indicator type error.

## Apply

Extract into the Nookly project root and run:

```powershell
node .\apply-repeat-download-typescript-fix.mjs
npx tsc --noEmit
```

No new APK build is required.
