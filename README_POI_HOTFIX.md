# Nookly POI Hotfix

This patch restores the nearby Points of Interest feature.

## Root cause

`lib/poiService.ts` was empty while `usePOIs`, `MapLayers`, and `AmenitiesBadge`
were importing functions and types from it.

## What the patch adds

- Free OpenStreetMap/Overpass nearby-place lookup
- Schools, universities, healthcare, shops, transport, police, food, parks, and fuel
- Two public Overpass endpoints with automatic fallback
- Six-hour local cache and stale-cache offline fallback
- Distance calculation and amenity summaries
- One request for all map-layer counts instead of one request per category
- Nearby-amenities cards on both property-detail views
- Full TypeScript types and safer coordinate handling

## Install

Extract the ZIP into the project root, then run:

```powershell
node apply-nookly-poi-hotfix.mjs
```

Do not open Expo Go yet. Run the verification command printed by the installer.
