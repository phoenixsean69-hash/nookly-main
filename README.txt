NOOKLY PUSH FUNCTION V1.4.2 HOTFIX

ROOT CAUSE

The deployed v1.4.1 Function contained two declarations of:

getUserRowByReference

Node therefore failed while loading src/main.js. Appwrite executions returned
an empty response body, which the terminal test reported as:

/lease-sent returned invalid JSON:

CONTENTS

apply-lease-function-v1.4.2-hotfix.mjs
nookly-push-api-v1.4.2-deploy.tar.gz

LOCAL SOURCE FIX

Extract this ZIP into the Nookly project root, then run:

node .\apply-lease-function-v1.4.2-hotfix.mjs

DEPLOYMENT

Upload:

nookly-push-api-v1.4.2-deploy.tar.gz

to Appwrite Function:

6a31d988001bf962fb57

Entrypoint:

src/main.js

Wait for Ready, then make the deployment Active.

RETEST

powershell -ExecutionPolicy Bypass -File .\run-lucan-send-lease-test.ps1
