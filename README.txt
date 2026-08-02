NOOKLY — TENANT → LANDLORD REQUEST & REVIEW NOTIFICATIONS

THIS PACKAGE DOES TWO THINGS

1. Fixes the production notification flows.
2. Adds a terminal test that acts as Beef Spook.

PRODUCTION FIXES

PROPERTY REQUEST

- Replaces the invalid literal document ID "unique()" with ID.unique().
- Removes the older duplicate client-side notification path.
- Adds authenticated Function route: /property-request.
- Verifies:
  - the tenant is authenticated;
  - the request row exists;
  - request.tenantId matches the authenticated tenant;
  - request.propertyId matches the supplied property;
  - the property owner is not the requesting tenant.
- Creates one deterministic in-app notification.
- Sends one push to the property owner.
- Tap opens /Landrequests.

PROPERTY REVIEW

- Adds reviewerId to each new review JSON object.
- Removes the two older duplicate notification sends.
- Adds authenticated Function route: /property-review.
- Verifies:
  - the reviewer is authenticated;
  - the property exists;
  - the exact reviewId exists inside properties.reviews;
  - review.reviewerId matches the authenticated reviewer;
  - the reviewer is not the property owner.
- Creates one deterministic in-app notification.
- Sends one push to the owner.
- Tap opens the exact property.

STRUCTURED REVIEW DATA

The landlord receives:

{
  "type": "review",
  "screen": "/properties/<propertyId>",
  "propertyId": "...",
  "propertyName": "...",
  "reviewId": "...",
  "reviewerId": "...",
  "reviewerName": "...",
  "reviewerAvatar": "...",
  "reviewerEmail": "...",
  "reviewerPhone": "...",
  "rating": 4,
  "stars": "★★★★☆",
  "reviewText": "...",
  "reviewedAt": "..."
}

The landlord Notifications screen renders this as a review card, not raw JSON.

FILES UPDATED

- lib/appwrite.ts
- services/push-function.service.ts
- functions/nookly-push-api/src/main.js
- app/(root)/(landlord)/landLordNotifications.tsx

FILES INCLUDED FOR TESTING

- scripts/tenant-landlord-notification-test.mjs
- run-tenant-landlord-tests.ps1
- package-push-function-v1.3.ps1

STEP 1 — APPLY

Extract into the Nookly project root:

node .\apply-tenant-landlord-notifications.mjs

STEP 2 — TYPESCRIPT

npx tsc --noEmit

Do not deploy until TypeScript is clean.

STEP 3 — BUILD FUNCTION ZIP

powershell -ExecutionPolicy Bypass -File .\package-push-function-v1.3.ps1

This creates:

nookly-push-api-v1.3.0-deploy.zip

STEP 4 — DEPLOY FUNCTION

In Appwrite Console:

Functions
→ nookly-push-api
→ Deployments
→ Create deployment
→ Manual
→ Upload nookly-push-api-v1.3.0-deploy.zip

Entrypoint:

src/main.js

Activate the new deployment.

The Requests table uses the built-in fallback:

69c3a9f30004facf9a4d

STEP 5 — TEST

Keep the phone logged into Lucan Muchayi and online for about 10 seconds.
Put the app in the background.

Run:

powershell -ExecutionPolicy Bypass -File .\run-tenant-landlord-tests.ps1

Press Enter to accept:

Beef email: beefspook22@gmail.com
Property: Yellow House
Property ID: 69c50097001babcc3e7c

Enter only Beef's password.

EXPECTED

Two pushes reach Lucan:

1. New Property Request
2. New Property Review

The terminal prints the exact structured JSON returned by the Function.

After tapping:

- Request opens Landlord Requests.
- Review opens Yellow House.

The landlord Notifications screen should show:
- request details in a purple card;
- reviewer name;
- property name;
- ★★★★☆ and 4.0/5;
- review text.
