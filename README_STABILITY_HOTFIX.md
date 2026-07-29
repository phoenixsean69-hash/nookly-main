# Nookly Stability Hotfix

This patch fixes three connected problems:

1. POI requests timing out on the outdated/overloaded endpoint path.
2. Property owner information sometimes resolving to an empty fallback.
3. Student tenants sometimes being routed into the ordinary tenant interface.

## Install

Extract this ZIP into the Nookly project root and run:

```powershell
node apply-nookly-stability-hotfix.mjs
```

The installer creates a timestamped backup before changing anything.
Do not open Expo Go until the focused ESLint command printed by the installer passes.
