# Nookly Driver Profile Suspension UI v2

This fixes the v1 installer interpolation bug and adds the suspension UI.

## Apply

Delete or ignore the old v1 installer, extract this ZIP into the project root,
then run:

```powershell
node .\apply-driver-profile-suspension-ui-v2.mjs
npx tsc --noEmit
```

The installer is idempotent and is safe even if some earlier changes were
partially applied.

No Function deployment or APK rebuild is required.
