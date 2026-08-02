NOOKLY — TERMINAL BEEF LIKE TEST V3

WHY V2 FAILED

The node-appwrite Server SDK created the email/password session, but because
there was no server API key, Appwrite did not expose session.secret in the JSON
response. The session still existed, so the v2 script could not authenticate
subsequent requests or delete that session.

V3 FIX

V3 uses Appwrite's client REST login directly:

1. POST /account/sessions/email
2. Capture the Appwrite session cookie from Set-Cookie
3. Authenticate subsequent requests using X-Appwrite-Session
4. Create the real Like
5. Increment properties.likes
6. Execute /property-like
7. DELETE /account/sessions/current

No API key is used.

REQUIREMENT

Node.js 20 or newer.

INSTALL

node .\install-terminal-like-test-v3.mjs

RUN

powershell -ExecutionPolicy Bypass -File .\run-beef-like-test.ps1

DEFAULTS

Beef email: beefspook22@gmail.com
Beef accountId: 6a6e3ba6000fb26e3dbc
Yellow House propertyId: 69c50097001babcc3e7c
Lucan accountId: 69c18e4400164e106828

BEFORE RUNNING

1. Sign into Lucan's landlord account on the phone.
2. Leave the app online for about 10 seconds.
3. Confirm Lucan has an active push token.
4. Put the app in the background.
5. Run the terminal test.

NOTE ABOUT THE V2 SESSION

The failed v2 attempt may have left one extra Beef session in Appwrite. That is
not dangerous, but Appwrite limits the number of active sessions. You can remove
old sessions later from Beef's Security/Sessions screen or the Appwrite Console.
V3 cleans up its own temporary session automatically.
