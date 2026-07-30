# Nookly Driver Scope + Avatar URL Fix

## Driver function

In Appwrite Console:

1. Open **Functions**.
2. Open **Nookly Rides Driver API**.
3. Open **Settings**.
4. Under **Scopes → Databases**, enable:
   - `documents.read`
   - keep `rows.read`
   - keep `rows.write`
5. Save.

The function reads the legacy `users` collection before reading the Rides tables.

## Avatar URL

Extract this ZIP into the project root, then run:

```powershell
node apply-nookly-avatar-url-hotfix.mjs
```

The patch changes uploaded avatar URLs to a guaranteed regional HTTPS Appwrite file-view URL.
