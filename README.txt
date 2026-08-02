NOOKLY PUSH REGISTRATION — ASYNC EXECUTION FIX

RUN FROM THE PROJECT ROOT:

powershell -ExecutionPolicy Bypass -File .\apply-push-registration-async-fix.ps1

UPDATED:
- services/push-function.service.ts
- app/_layout.tsx

BACKUPS:
- services/push-function.service.ts.async-register.bak
- app/_layout.tsx.async-register.bak

WHY THE ERROR OCCURRED

The mobile service invoked /register-device using:

async: false

That makes Appwrite wait for the function to finish. Synchronous function
executions have a hard 30-second limit. Registration may take longer while
the function starts, searches existing token rows, updates the primary row
and deactivates duplicate rows.

WHAT CHANGES

- /register-device is submitted with async: true.
- Appwrite immediately queues the registration execution.
- The mobile app stores the Expo token after Appwrite accepts the job.
- The mobile app no longer waits for token cleanup and row updates.
- The execution ID and initial queue status are logged for diagnosis.
- The backend function code does not need to be redeployed.
- /test and notification-producing routes remain synchronous for now.

EXPECTED LOG

✅ Push device registration queued through Nookly Push API
   (<execution ID>, waiting)

AFTER APPLYING:

npx tsc --noEmit
