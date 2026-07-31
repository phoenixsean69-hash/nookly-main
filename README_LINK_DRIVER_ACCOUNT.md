# Link the new Nookly driver account

This script links:

```text
jsjzjjz@gmail.com
```

to the existing verified driver profile:

```text
6a6a6808000d95107895
```

The driver profile ID stays unchanged, so existing vehicle and ride assignments remain attached.

## Run

Make sure the current PowerShell session still contains:

```powershell
$env:APPWRITE_API_KEY
```

Then run from the Nookly project root:

```powershell
node --env-file=.env link-new-driver-account.mjs
```

To use a different email or profile ID:

```powershell
$env:TARGET_DRIVER_EMAIL="another@example.com"
$env:TARGET_DRIVER_PROFILE_ID="profile-id"
node --env-file=.env link-new-driver-account.mjs
```
