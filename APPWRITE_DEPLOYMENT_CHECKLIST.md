# Appwrite Deployment Checklist

## Nookly Push API

- [ ] Add `NOOKLY_RIDES_PUSH_SECRET`
- [ ] Deploy `nookly-push-api-v1.5.0.tar.gz`
- [ ] Entrypoint is `src/main.js`
- [ ] Build command is `npm install`
- [ ] Deployment becomes Active
- [ ] `/health` reports version `1.5.0`
- [ ] `/health` reports `ridesPushSecret: true`

## Rides Function

- [ ] Add `NOOKLY_PUSH_FUNCTION_ID=6a31d988001bf962fb57`
- [ ] Add the same `NOOKLY_RIDES_PUSH_SECRET`
- [ ] Enable dynamic API-key scope `execution.write`
- [ ] Redeploy
- [ ] Confirm execution logs show `driver-ride-push-queued`

## Mobile

- [ ] Run `npx tsc --noEmit`
- [ ] Reload the development build
- [ ] Test new request push
- [ ] Test accepted offer push
- [ ] Test cancelled request push
- [ ] Confirm push taps deep-link correctly
