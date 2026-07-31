# Nookly Driver Tabs + Android Text Rendering Hotfix

This patch does two things.

## Driver tabs

The Driver navigator now follows the ordinary Tenant navigator:

- PNG image icons from `constants/icons.ts`
- the same active and inactive colors
- the same 80px bottom-bar sizing
- the same border style
- full-width centered labels
- Android-safe label padding and single-line measurement

Icons:

- Home → `icons.home`
- Rides → `icons.calendar`
- Active → `icons.location`
- Profile → `icons.person`

## Random Android text clipping

The project uses React Native 0.81.5. Some Android devices can measure text
slightly too narrowly in this React Native line, causing final characters or
parts of words to disappear intermittently.

A Babel transform appends a very thin spacer to the outermost React Native
`<Text>` element on Android only. It does not alter nested inline Text spans,
and it produces an empty string on iOS and web.

This is a temporary compatibility workaround until Nookly upgrades to an Expo
SDK whose React Native version contains the upstream native fix.

## Install

Extract this ZIP into the Nookly project root, then run:

```powershell
node apply-nookly-driver-tabs-text-rendering-hotfix.mjs
```

Run the three validation commands printed by the installer before restarting
Expo.
