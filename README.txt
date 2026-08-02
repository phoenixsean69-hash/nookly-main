NOOKLY STEP 8 — CORRECTED INSTANT AVATAR PATCH

The first Step 8 script stopped before writing because its validation rejected
any occurrence of the word loadingAvatar, including harmless leftover text.

Run this corrected version from the project root:

node .\apply-step-8-fix.mjs

WHAT IT DOES
- Shows user.avatar immediately when available.
- Otherwise shows the built-in/default avatar immediately.
- Stores the selected built-in avatar in AsyncStorage.
- Refreshes Appwrite preferences quietly in the background.
- Removes only actual blocking loadingAvatar state/render gates.
- During image upload, keeps the old avatar visible with a progress overlay.
- Uses tolerant pattern matching for locally modified files.
- Writes nothing until all targeted validations pass.

UPDATED
- utils/avatarStorage.ts
- app/(root)/(tabs)/tenantHome.tsx
- app/(root)/(landlord)/landHome.tsx
- app/(root)/(landlord)/landProfile.tsx

BACKUPS
Each updated file receives a .step8-fix.bak copy.

After applying:

npx tsc --noEmit
