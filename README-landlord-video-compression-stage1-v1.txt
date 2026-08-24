NOOKLY LANDLORD VIDEO COMPRESSION — STAGE 1 v1

PURPOSE
-------
Adapt the already-successful Nookly WEB property-video workflow to the
landlord MOBILE app, one controlled step at a time.

CURRENT MOBILE STATE
--------------------
The mobile landlord Add Listing screen already has:
- video selection from gallery;
- video recording;
- minimum 2 / maximum 3 videos;
- a 90-second picker validation;
- video1 / video2 / video3 database fields;
- existing property-detail video playback.

The major missing part is compression: uploadVideo() currently sends the
ORIGINAL local video URI directly to Appwrite.

STAGE 1 DOES
------------
- pins @bsky.app/video-compressor@0.2.0;
- creates lib/propertyVideoCompression.ts;
- implements:
    source <= 500 MB
    duration <= 90 seconds
    MP4 / MOV / M4V / WebM input gate
    H.264 encode
    target video bitrate ~1 Mbps
    max long edge 1280 px
      (1280x720 landscape / 720x1280 portrait envelope)
    max 30 FPS
    MP4 output verification
    compressed output <= 18 MB
    progress callback
- forces re-encoding instead of allowing a small HEVC/MOV source to pass
  through unchanged;
- verifies output URI, file size, duration, dimensions, MIME and codec.

STAGE 1 DOES NOT
----------------
- modify addProperty.tsx;
- modify uploadVideo();
- upload media;
- modify/delete Appwrite data.

WHY THIS LIBRARY
----------------
The successful web flow uses Mediabunny inside the browser. React Native needs
native video processing. @bsky.app/video-compressor is designed for React
Native/Expo: native VideoToolbox on iOS and MediaCodec/MediaMuxer on Android,
while its web backend itself uses Mediabunny/WebCodecs.

AUDIO NOTE
----------
The web workflow explicitly targets AAC audio at ~80 kbps. The documented
public compressor API exposes explicit video codec, bitrate, resolution and
frame-rate controls, but not an AAC bitrate option. Stage 1 therefore does not
claim that the 80 kbps audio target is guaranteed. Runtime output compatibility
will be verified rather than guessed.

RUN
---
Extract into Downloads, then:

cd "$env:USERPROFILE\Downloads"

node .\install-landlord-video-compression-stage1-v1.cjs `
  --mobile-project "C:\Users\nooklyweb\Desktop\nookly-with-students"

Paste the COMPLETE installer + TypeScript output before Stage 2.

NATIVE BUILD NOTE
-----------------
This package contains native code. After Stage 2 integrates it into the screen,
a fresh Expo development-client build will be required before runtime testing.
