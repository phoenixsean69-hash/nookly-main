# Nookly Avatar Upload Auth Hotfix

Fixes:

- Avatar upload being attempted before an Appwrite session exists.
- Appwrite client platform mismatch (`com.tekto99.rentify` versus the actual Android package `com.shon1123.Nookly`).
- Fragile local-file size detection.
- Hardcoded non-regional Appwrite storage view URL.
- Signup failing or producing noisy errors when an optional avatar cannot upload.

The new flow is:

1. Create the Appwrite account and session.
2. Create and cache the Nookly user document.
3. Upload the optional avatar as the authenticated user.
4. Update and cache the avatar URL.
5. Keep the account usable with its default avatar when upload fails.

## Install

Extract into the project root, then run:

```powershell
node apply-nookly-avatar-upload-auth-hotfix.mjs
```
