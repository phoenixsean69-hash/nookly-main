Nookly Driver endpoint path hotfix

Appwrite's current React Native createExecution call uses `xpath` for the
execution path. The Nookly service was sending `path`, which was ignored and
defaulted every request to `/`.

Install:

node apply-nookly-driver-endpoint-path-hotfix.mjs
