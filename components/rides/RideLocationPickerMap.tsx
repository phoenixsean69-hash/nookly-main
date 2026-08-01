import * as Location from "expo-location";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

export interface RideMapCoordinate {
  latitude: number;
  longitude: number;
}

export interface RideNearbyDriverMapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  estimatedPickupMinutes?: number;
  vehicleLabel?: string;
  registrationNumber?: string;
  isDemo?: boolean;
}

type RideMapLayer = "street" | "hybrid";
type RideTravelMode = "walk" | "drive";

type MapMessage = {
  type?: string;
  latitude?: number;
  longitude?: number;
  layer?: RideMapLayer;
  driverId?: string;
};

type RouteGeometry = {
  type: "LineString";
  coordinates: number[][];
};

type RouteInfo = {
  mode: RideTravelMode;
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
};

type PlaceSearchResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
};

export interface RideLocationPickerMapHandle {
  openFullScreen: (focusNearbyDriverId?: string) => void;
  closeFullScreen: () => void;
  focusNearbyDriver: (driverId: string) => void;
}

interface RideLocationPickerMapProps {
  selectedCoordinate?: RideMapCoordinate | null;
  /**
   * Kept for compatibility with existing screens.
   * The picker intentionally opens in Bindura when there is no selection.
   */
  initialCenter?: RideMapCoordinate;
  onSelect: (coordinate: RideMapCoordinate) => void;
  originCoordinate?: RideMapCoordinate | null;
  nearbyDrivers?: RideNearbyDriverMapMarker[];
  onNearbyDriverPress?: (driverId: string) => void;
  darkMode?: boolean;
  height?: number;
  initialLayer?: RideMapLayer;
}

/** Bindura city centre: longitude 31.3306, latitude -17.3019. */
const BINDURA_CENTER: RideMapCoordinate = {
  latitude: -17.3019,
  longitude: 31.3306,
};

/** A relaxed city-and-surroundings view rather than a street-level zoom. */
const BINDURA_START_ZOOM = 8.75;
const PUBLIC_API_MIN_INTERVAL_MS = 1100;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isValidCoordinate = (
  coordinate?: RideMapCoordinate | null,
): coordinate is RideMapCoordinate => {
  if (
    !coordinate ||
    !Number.isFinite(coordinate.latitude) ||
    coordinate.latitude < -90 ||
    coordinate.latitude > 90 ||
    !Number.isFinite(coordinate.longitude) ||
    coordinate.longitude < -180 ||
    coordinate.longitude > 180
  ) {
    return false;
  }

  const isZeroPlaceholder =
    Math.abs(coordinate.latitude) < 0.000001 &&
    Math.abs(coordinate.longitude) < 0.000001;

  return !isZeroPlaceholder;
};

const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "—";

  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
};

const buildMapHtml = ({
  selectedCoordinate,
  initialLayer,
  fullScreen,
}: {
  selectedCoordinate?: RideMapCoordinate | null;
  darkMode: boolean;
  initialLayer: RideMapLayer;
  fullScreen: boolean;
}) => {
  const selected = isValidCoordinate(selectedCoordinate)
    ? selectedCoordinate
    : null;

  const initialZoom = BINDURA_START_ZOOM;
  const streetStyleName = "bright";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link
      href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"
      rel="stylesheet"
    />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #eef2f7;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      .layer-switcher {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 10;
        display: flex;
        padding: 3px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.2);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .layer-button {
        min-width: 64px;
        border: 0;
        border-radius: 8px;
        padding: 8px 10px;
        background: transparent;
        color: #334155;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }

      .layer-button.active {
        background: #2563eb;
        color: #ffffff;
      }

      .layer-button:active {
        opacity: 0.78;
      }

      .user-location-dot {
        width: 18px;
        height: 18px;
        border: 4px solid #ffffff;
        border-radius: 50%;
        background: #2563eb;
        box-shadow: 0 1px 8px rgba(15, 23, 42, 0.45);
      }

      .pickup-location-dot {
        width: 20px;
        height: 20px;
        border: 4px solid #ffffff;
        border-radius: 50%;
        background: #f97316;
        box-shadow: 0 1px 9px rgba(15, 23, 42, 0.4);
      }

      .nearby-driver-marker {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        border-radius: 50%;
        background: #16a34a;
        box-shadow: 0 3px 12px rgba(15, 23, 42, 0.38);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      .nearby-driver-marker.demo {
        background: #7c3aed;
      }

      .nearby-driver-marker:active {
        transform: scale(0.94);
      }

      .driver-popup {
        min-width: 180px;
        max-width: 240px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
      }

      .driver-popup-name {
        font-size: 14px;
        font-weight: 800;
      }

      .driver-popup-detail {
        margin-top: 4px;
        font-size: 12px;
        line-height: 17px;
        color: #475569;
      }

      .driver-popup-badge {
        display: inline-block;
        margin-top: 7px;
        border-radius: 999px;
        padding: 3px 7px;
        background: #ede9fe;
        color: #6d28d9;
        font-size: 10px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>

    <div class="layer-switcher" aria-label="Map layer selector">
      <button id="streetButton" class="layer-button" type="button">
        Street
      </button>
      <button id="hybridButton" class="layer-button" type="button">
        Hybrid
      </button>
    </div>

    <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
    <script>
      (function () {
        const binduraCenter = [${BINDURA_CENTER.longitude}, ${BINDURA_CENTER.latitude}];
        const initialCenter = [${BINDURA_CENTER.longitude}, ${BINDURA_CENTER.latitude}];
        const initialZoom = ${initialZoom};
        const isFullScreen = ${fullScreen ? "true" : "false"};
        const initialSelection = ${
          selected
            ? JSON.stringify({
                longitude: selected.longitude,
                latitude: selected.latitude,
              })
            : "null"
        };

        const streetStyle = "https://tiles.openfreemap.org/styles/${streetStyleName}";

        const hybridStyle = {
          version: 8,
          name: "Nookly Hybrid",
          sources: {
            imagery: {
              type: "raster",
              tiles: [
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              ],
              tileSize: 256,
              minzoom: 0,
              maxzoom: 19,
              attribution:
                "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            },
            reference: {
              type: "raster",
              tiles: [
                "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              ],
              tileSize: 256,
              minzoom: 0,
              maxzoom: 19,
              attribution: "Reference labels © Esri"
            }
          },
          layers: [
            {
              id: "imagery",
              type: "raster",
              source: "imagery",
              minzoom: 0,
              maxzoom: 20
            },
            {
              id: "reference-labels",
              type: "raster",
              source: "reference",
              minzoom: 0,
              maxzoom: 20
            }
          ]
        };

        let destinationMarker = null;
        let userMarker = null;
        let pickupMarker = null;
        const nearbyDriverMarkers = new Map();
        let currentNearbyDrivers = [];
        let currentLayer = ${JSON.stringify(initialLayer)};
        let currentRouteFeature = null;
        let currentRouteMode = "drive";

        const sendMessage = (payload) => {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        };

        const map = new maplibregl.Map({
          container: "map",
          style: currentLayer === "hybrid" ? hybridStyle : streetStyle,
          center: initialCenter,
          zoom: initialZoom,
          minZoom: 3,
          maxZoom: 19,
          pitch: 0,
          bearing: 0,
          attributionControl: false,
        });

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: isFullScreen,
            showZoom: true,
            visualizePitch: true,
          }),
          "top-right",
        );

        const streetButton = document.getElementById("streetButton");
        const hybridButton = document.getElementById("hybridButton");

        const updateLayerButtons = () => {
          streetButton.classList.toggle("active", currentLayer === "street");
          hybridButton.classList.toggle("active", currentLayer === "hybrid");
        };

        const createArrowImage = () => {
          if (map.hasImage("nookly-route-arrow")) return;

          const canvas = document.createElement("canvas");
          canvas.width = 28;
          canvas.height = 28;
          const context = canvas.getContext("2d");
          if (!context) return;

          context.clearRect(0, 0, 28, 28);
          context.beginPath();
          context.moveTo(4, 5);
          context.lineTo(24, 14);
          context.lineTo(4, 23);
          context.lineTo(9, 14);
          context.closePath();
          context.fillStyle = "#ffffff";
          context.shadowColor = "rgba(15, 23, 42, 0.5)";
          context.shadowBlur = 2;
          context.fill();

          map.addImage(
            "nookly-route-arrow",
            context.getImageData(0, 0, 28, 28),
            { pixelRatio: 2 },
          );
        };

        const routeColor = () =>
          currentRouteMode === "walk" ? "#16a34a" : "#2563eb";

        const ensureRouteLayers = () => {
          if (!currentRouteFeature || !map.isStyleLoaded()) return;

          createArrowImage();

          const existingSource = map.getSource("nookly-route");
          if (existingSource) {
            existingSource.setData(currentRouteFeature);
          } else {
            map.addSource("nookly-route", {
              type: "geojson",
              data: currentRouteFeature,
            });
          }

          if (!map.getLayer("nookly-route-casing")) {
            map.addLayer({
              id: "nookly-route-casing",
              type: "line",
              source: "nookly-route",
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#ffffff",
                "line-width": 9,
                "line-opacity": 0.92,
              },
            });
          }

          if (!map.getLayer("nookly-route-line")) {
            map.addLayer({
              id: "nookly-route-line",
              type: "line",
              source: "nookly-route",
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": routeColor(),
                "line-width": 5,
                "line-opacity": 0.98,
              },
            });
          } else {
            map.setPaintProperty(
              "nookly-route-line",
              "line-color",
              routeColor(),
            );
          }

          if (!map.getLayer("nookly-route-arrows")) {
            map.addLayer({
              id: "nookly-route-arrows",
              type: "symbol",
              source: "nookly-route",
              layout: {
                "symbol-placement": "line",
                "symbol-spacing": 90,
                "icon-image": "nookly-route-arrow",
                "icon-size": 0.7,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-rotation-alignment": "map",
              },
            });
          }
        };

        const fitRoute = () => {
          if (!currentRouteFeature) return;

          const coordinates = currentRouteFeature.geometry.coordinates;
          if (!coordinates || coordinates.length < 2) return;

          const bounds = coordinates.reduce(
            (result, coordinate) => result.extend(coordinate),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
          );

          map.fitBounds(bounds, {
            padding: isFullScreen
              ? { top: 70, right: 42, bottom: 70, left: 42 }
              : 32,
            maxZoom: 15,
            duration: 650,
          });
        };

        const setMapLayer = (nextLayer, notifyNative) => {
          if (nextLayer !== "street" && nextLayer !== "hybrid") return;
          if (currentLayer === nextLayer) return;

          const camera = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          };

          currentLayer = nextLayer;
          updateLayerButtons();
          map.setStyle(currentLayer === "hybrid" ? hybridStyle : streetStyle);

          map.once("styledata", () => {
            map.jumpTo(camera);
          });

          if (notifyNative !== false) {
            sendMessage({
              type: "map-layer-changed",
              layer: currentLayer,
            });
          }
        };

        streetButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setMapLayer("street", true);
        });

        hybridButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setMapLayer("hybrid", true);
        });

        updateLayerButtons();

        const ensureDestinationMarker = (latitude, longitude) => {
          if (!destinationMarker) {
            destinationMarker = new maplibregl.Marker({
              color: "#dc2626",
              draggable: true,
            })
              .setLngLat([longitude, latitude])
              .addTo(map);

            destinationMarker.on("dragend", () => {
              const position = destinationMarker.getLngLat();
              publishCoordinate(position.lat, position.lng);
            });
          } else {
            destinationMarker.setLngLat([longitude, latitude]);
          }
        };

        const ensureUserMarker = (latitude, longitude) => {
          if (!userMarker) {
            const element = document.createElement("div");
            element.className = "user-location-dot";

            userMarker = new maplibregl.Marker({ element })
              .setLngLat([longitude, latitude])
              .addTo(map);
          } else {
            userMarker.setLngLat([longitude, latitude]);
          }
        };

        const ensurePickupMarker = (latitude, longitude) => {
          if (!pickupMarker) {
            const element = document.createElement("div");
            element.className = "pickup-location-dot";
            element.setAttribute("aria-label", "Pickup location");

            pickupMarker = new maplibregl.Marker({ element })
              .setLngLat([longitude, latitude])
              .addTo(map);
          } else {
            pickupMarker.setLngLat([longitude, latitude]);
          }
        };

        const createDriverPopup = (driver) => {
          const root = document.createElement("div");
          root.className = "driver-popup";

          const name = document.createElement("div");
          name.className = "driver-popup-name";
          name.textContent = driver.name || "Verified driver";
          root.appendChild(name);

          const distance = Number(driver.distanceMeters);
          const eta = Number(driver.estimatedPickupMinutes);
          const details = [];

          if (Number.isFinite(distance)) {
            details.push(
              distance < 1000
                ? Math.max(1, Math.round(distance)) + " m away"
                : (distance / 1000).toFixed(1) + " km away",
            );
          }

          if (Number.isFinite(eta)) {
            details.push(Math.max(1, Math.round(eta)) + " min pickup");
          }

          if (driver.vehicleLabel) {
            details.push(String(driver.vehicleLabel));
          }

          if (driver.registrationNumber) {
            details.push(String(driver.registrationNumber));
          }

          if (details.length) {
            const detail = document.createElement("div");
            detail.className = "driver-popup-detail";
            detail.textContent = details.join(" · ");
            root.appendChild(detail);
          }

          if (driver.isDemo === true) {
            const badge = document.createElement("span");
            badge.className = "driver-popup-badge";
            badge.textContent = "Demo driver";
            root.appendChild(badge);
          }

          return root;
        };

        const setNearbyDrivers = (drivers, focusDriverId) => {
          const nextDrivers = Array.isArray(drivers) ? drivers : [];
          currentNearbyDrivers = nextDrivers;

          const nextIds = new Set(
            nextDrivers.map((driver) => String(driver.id || "")),
          );

          nearbyDriverMarkers.forEach((marker, driverId) => {
            if (!nextIds.has(driverId)) {
              marker.remove();
              nearbyDriverMarkers.delete(driverId);
            }
          });

          nextDrivers.forEach((driver) => {
            const driverId = String(driver.id || "");
            const latitude = Number(driver.latitude);
            const longitude = Number(driver.longitude);

            if (
              !driverId ||
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude)
            ) {
              return;
            }

            let marker = nearbyDriverMarkers.get(driverId);

            if (!marker) {
              const element = document.createElement("button");
              element.type = "button";
              element.className =
                "nearby-driver-marker" +
                (driver.isDemo === true ? " demo" : "");
              element.textContent = "🚘";
              element.setAttribute(
                "aria-label",
                (driver.name || "Driver") + " nearby",
              );

              element.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const activeMarker = nearbyDriverMarkers.get(driverId);
                activeMarker?.togglePopup();

                sendMessage({
                  type: "nearby-driver-selected",
                  driverId,
                });
              });

              marker = new maplibregl.Marker({
                element,
                anchor: "center",
              })
                .setLngLat([longitude, latitude])
                .setPopup(
                  new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    offset: 24,
                  }).setDOMContent(createDriverPopup(driver)),
                )
                .addTo(map);

              nearbyDriverMarkers.set(driverId, marker);
            } else {
              marker.setLngLat([longitude, latitude]);
              marker.setPopup(
                new maplibregl.Popup({
                  closeButton: true,
                  closeOnClick: false,
                  offset: 24,
                }).setDOMContent(createDriverPopup(driver)),
              );
            }
          });

          if (focusDriverId) {
            const focusedDriver = nextDrivers.find(
              (driver) => String(driver.id || "") === String(focusDriverId),
            );

            if (focusedDriver) {
              const latitude = Number(focusedDriver.latitude);
              const longitude = Number(focusedDriver.longitude);

              if (
                Number.isFinite(latitude) &&
                Number.isFinite(longitude)
              ) {
                map.easeTo({
                  center: [longitude, latitude],
                  zoom: Math.max(map.getZoom(), 15),
                  duration: 650,
                });

                setTimeout(() => {
                  const marker = nearbyDriverMarkers.get(
                    String(focusDriverId),
                  );
                  marker?.togglePopup();
                }, 680);
              }
            }
          }
        };

        const publishCoordinate = (latitude, longitude) => {
          const normalizedLatitude = Number(Number(latitude).toFixed(6));
          const normalizedLongitude = Number(Number(longitude).toFixed(6));

          ensureDestinationMarker(normalizedLatitude, normalizedLongitude);

          sendMessage({
            type: "location-selected",
            latitude: normalizedLatitude,
            longitude: normalizedLongitude,
          });
        };

        window.setNooklyRideLocation = (latitude, longitude, focus) => {
          const nextLatitude = Number(latitude);
          const nextLongitude = Number(longitude);

          if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
            return;
          }

          ensureDestinationMarker(nextLatitude, nextLongitude);

          if (focus === true) {
            map.easeTo({
              center: [nextLongitude, nextLatitude],
              zoom: Math.max(map.getZoom(), 14),
              duration: 650,
            });
          }
        };

        window.setNooklyUserLocation = (latitude, longitude, focus) => {
          const nextLatitude = Number(latitude);
          const nextLongitude = Number(longitude);

          if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
            return;
          }

          ensureUserMarker(nextLatitude, nextLongitude);

          if (focus === true) {
            map.easeTo({
              center: [nextLongitude, nextLatitude],
              zoom: Math.max(map.getZoom(), 14),
              duration: 650,
            });
          }
        };

        window.setNooklyPickupLocation = (latitude, longitude, focus) => {
          const nextLatitude = Number(latitude);
          const nextLongitude = Number(longitude);

          if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
            return;
          }

          ensurePickupMarker(nextLatitude, nextLongitude);

          if (focus === true) {
            map.easeTo({
              center: [nextLongitude, nextLatitude],
              zoom: Math.max(map.getZoom(), 14),
              duration: 650,
            });
          }
        };

        window.setNooklyNearbyDrivers = (drivers, focusDriverId) => {
          setNearbyDrivers(drivers, focusDriverId);
        };

        window.focusNooklyNearbyDriver = (driverId) => {
          setNearbyDrivers(currentNearbyDrivers, driverId);
        };

        window.setNooklyRideRoute = (geometry, mode) => {
          if (!geometry || geometry.type !== "LineString") return;

          currentRouteMode = mode === "walk" ? "walk" : "drive";
          currentRouteFeature = {
            type: "Feature",
            properties: { mode: currentRouteMode },
            geometry,
          };

          ensureRouteLayers();
          fitRoute();
        };

        window.clearNooklyRideRoute = () => {
          currentRouteFeature = null;

          if (map.getLayer("nookly-route-arrows")) {
            map.removeLayer("nookly-route-arrows");
          }
          if (map.getLayer("nookly-route-line")) {
            map.removeLayer("nookly-route-line");
          }
          if (map.getLayer("nookly-route-casing")) {
            map.removeLayer("nookly-route-casing");
          }
          if (map.getSource("nookly-route")) {
            map.removeSource("nookly-route");
          }
        };

        window.setNooklyRideMapLayer = (layer) => {
          setMapLayer(layer, false);
        };

        let initialCameraLocked = true;

        const forceBinduraOpeningCamera = () => {
          if (!initialCameraLocked) return;

          map.stop();
          map.jumpTo({
            center: binduraCenter,
            zoom: initialZoom,
            bearing: 0,
            pitch: 0,
          });
        };

        map.on("style.load", () => {
          ensureRouteLayers();
        });

        map.on("load", () => {
          forceBinduraOpeningCamera();
          requestAnimationFrame(forceBinduraOpeningCamera);
          setTimeout(forceBinduraOpeningCamera, 120);
          setTimeout(() => {
            forceBinduraOpeningCamera();
            initialCameraLocked = false;
          }, 450);

          if (initialSelection) {
            ensureDestinationMarker(
              initialSelection.latitude,
              initialSelection.longitude,
            );
          }

          sendMessage({
            type: "map-ready",
            layer: currentLayer,
          });
        });

        map.on("mousedown", () => {
          initialCameraLocked = false;
        });

        map.on("touchstart", () => {
          initialCameraLocked = false;
        });

        map.on("click", (event) => {
          initialCameraLocked = false;
          publishCoordinate(event.lngLat.lat, event.lngLat.lng);
        });
      })();
    </script>
  </body>
</html>`;
};

const RideLocationPickerMap = forwardRef<
  RideLocationPickerMapHandle,
  RideLocationPickerMapProps
>(function RideLocationPickerMap(
  {
    selectedCoordinate,
    onSelect,
    originCoordinate,
    nearbyDrivers = [],
    onNearbyDriverPress,
    darkMode = false,
    height = 270,
    initialLayer = "street",
  }: RideLocationPickerMapProps,
  ref,
) {
  const inlineWebViewRef = useRef<any>(null);
  const modalWebViewRef = useRef<any>(null);
  const searchCacheRef = useRef<Map<string, PlaceSearchResult[]>>(new Map());
  const lastSearchAtRef = useRef(0);
  const lastRouteRequestAtRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFocusDriverIdRef = useRef<string | null>(null);

  const [inlineReady, setInlineReady] = useState(false);
  const [modalReady, setModalReady] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [modalError, setModalError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<RideMapLayer>(initialLayer);
  const [modalHtml, setModalHtml] = useState("");

  const [userCoordinate, setUserCoordinate] =
    useState<RideMapCoordinate | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);

  const [routes, setRoutes] = useState<
    Partial<Record<RideTravelMode, RouteInfo>>
  >({});
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [activeTravelMode, setActiveTravelMode] =
    useState<RideTravelMode>("drive");

  const initialSelectedCoordinate = useRef(selectedCoordinate).current;

  const inlineHtml = useMemo(
    () =>
      buildMapHtml({
        selectedCoordinate: initialSelectedCoordinate,
        darkMode,
        initialLayer,
        fullScreen: false,
      }),
    [darkMode, initialLayer, initialSelectedCoordinate],
  );

  const selectedLatitude = isValidCoordinate(selectedCoordinate)
    ? selectedCoordinate.latitude
    : undefined;
  const selectedLongitude = isValidCoordinate(selectedCoordinate)
    ? selectedCoordinate.longitude
    : undefined;

  const injectLocation = (
    targetRef: React.MutableRefObject<any>,
    latitude: number,
    longitude: number,
    focus = false,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyRideLocation) {
        window.setNooklyRideLocation(${latitude}, ${longitude}, ${focus});
      }
      true;
    `);
  };

  const injectUserLocation = (
    targetRef: React.MutableRefObject<any>,
    latitude: number,
    longitude: number,
    focus = false,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyUserLocation) {
        window.setNooklyUserLocation(${latitude}, ${longitude}, ${focus});
      }
      true;
    `);
  };

  const injectPickupLocation = (
    targetRef: React.MutableRefObject<any>,
    latitude: number,
    longitude: number,
    focus = false,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyPickupLocation) {
        window.setNooklyPickupLocation(${latitude}, ${longitude}, ${focus});
      }
      true;
    `);
  };

  const injectNearbyDrivers = (
    targetRef: React.MutableRefObject<any>,
    drivers: RideNearbyDriverMapMarker[],
    focusDriverId?: string | null,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyNearbyDrivers) {
        window.setNooklyNearbyDrivers(
          ${JSON.stringify(drivers)},
          ${JSON.stringify(focusDriverId || null)}
        );
      }
      true;
    `);
  };

  const focusInjectedNearbyDriver = (
    targetRef: React.MutableRefObject<any>,
    driverId: string,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.focusNooklyNearbyDriver) {
        window.focusNooklyNearbyDriver(${JSON.stringify(driverId)});
      }
      true;
    `);
  };

  const injectLayer = (
    targetRef: React.MutableRefObject<any>,
    layer: RideMapLayer,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyRideMapLayer) {
        window.setNooklyRideMapLayer(${JSON.stringify(layer)});
      }
      true;
    `);
  };

  const injectRoute = (
    targetRef: React.MutableRefObject<any>,
    route: RouteInfo,
  ) => {
    targetRef.current?.injectJavaScript(`
      if (window.setNooklyRideRoute) {
        window.setNooklyRideRoute(
          ${JSON.stringify(route.geometry)},
          ${JSON.stringify(route.mode)}
        );
      }
      true;
    `);
  };

  const clearInjectedRoute = (targetRef: React.MutableRefObject<any>) => {
    targetRef.current?.injectJavaScript(`
      if (window.clearNooklyRideRoute) {
        window.clearNooklyRideRoute();
      }
      true;
    `);
  };

  useEffect(() => {
    if (selectedLatitude === undefined || selectedLongitude === undefined) {
      return;
    }

    if (inlineReady) {
      injectLocation(inlineWebViewRef, selectedLatitude, selectedLongitude);
    }

    if (modalReady) {
      injectLocation(modalWebViewRef, selectedLatitude, selectedLongitude);
    }
  }, [inlineReady, modalReady, selectedLatitude, selectedLongitude]);

  useEffect(() => {
    if (!modalReady || !userCoordinate) return;

    injectUserLocation(
      modalWebViewRef,
      userCoordinate.latitude,
      userCoordinate.longitude,
      false,
    );
  }, [modalReady, userCoordinate]);

  useEffect(() => {
    if (!isValidCoordinate(originCoordinate)) return;

    if (inlineReady) {
      injectPickupLocation(
        inlineWebViewRef,
        originCoordinate.latitude,
        originCoordinate.longitude,
        false,
      );
    }

    if (modalReady) {
      injectPickupLocation(
        modalWebViewRef,
        originCoordinate.latitude,
        originCoordinate.longitude,
        false,
      );
    }
  }, [
    inlineReady,
    modalReady,
    originCoordinate?.latitude,
    originCoordinate?.longitude,
  ]);

  useEffect(() => {
    if (inlineReady) {
      injectNearbyDrivers(inlineWebViewRef, nearbyDrivers);
    }

    if (modalReady) {
      const focusDriverId = pendingFocusDriverIdRef.current;
      injectNearbyDrivers(
        modalWebViewRef,
        nearbyDrivers,
        focusDriverId,
      );
      pendingFocusDriverIdRef.current = null;
    }
  }, [inlineReady, modalReady, nearbyDrivers]);

  useEffect(() => {
    if (!modalReady) return;

    const activeRoute = routes[activeTravelMode];
    if (activeRoute) {
      injectRoute(modalWebViewRef, activeRoute);
    } else {
      clearInjectedRoute(modalWebViewRef);
    }
  }, [activeTravelMode, modalReady, routes]);

  const refreshUserLocation = async (focusAfterLoading = false) => {
    try {
      setLocationLoading(true);
      setLocationError("");

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError(
          "Location permission is needed to calculate walking and driving routes.",
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setUserCoordinate(coordinate);

      if (modalReady) {
        injectUserLocation(
          modalWebViewRef,
          coordinate.latitude,
          coordinate.longitude,
          focusAfterLoading,
        );
      }

      return coordinate;
    } catch (error) {
      console.warn("Could not get the current location:", error);
      setLocationError("Your current location could not be obtained.");
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const waitForSearchRateLimit = async () => {
    const elapsed = Date.now() - lastSearchAtRef.current;
    if (elapsed < PUBLIC_API_MIN_INTERVAL_MS) {
      await delay(PUBLIC_API_MIN_INTERVAL_MS - elapsed);
    }
    lastSearchAtRef.current = Date.now();
  };

  const runPlaceSearch = async () => {
    const query = searchQuery.trim();

    if (query.length < 3) {
      setSearchError("Enter at least 3 characters.");
      setSearchResults([]);
      return;
    }

    const cacheKey = query.toLocaleLowerCase();
    const cachedResults = searchCacheRef.current.get(cacheKey);
    if (cachedResults) {
      setSearchResults(cachedResults);
      setSearchError(cachedResults.length ? "" : "No places were found.");
      return;
    }

    try {
      setSearching(true);
      setSearchError("");
      setSearchResults([]);

      await waitForSearchRateLimit();

      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
        countrycodes: "zw",
        "accept-language": "en",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Language": "en",
            "User-Agent": "Nookly-Mobile/1.0",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = (await response.json()) as PlaceSearchResult[];
      const validResults = Array.isArray(data)
        ? data.filter(
            (item) =>
              Number.isFinite(Number(item.lat)) &&
              Number.isFinite(Number(item.lon)),
          )
        : [];

      searchCacheRef.current.set(cacheKey, validResults);
      setSearchResults(validResults);

      if (!validResults.length) {
        setSearchError("No matching places were found in Zimbabwe.");
      }
    } catch (error) {
      console.warn("Place search failed:", error);
      setSearchError("Place search is temporarily unavailable.");
    } finally {
      setSearching(false);
    }
  };

  const chooseSearchResult = (result: PlaceSearchResult) => {
    const coordinate = {
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    };

    if (!isValidCoordinate(coordinate)) return;

    setSearchQuery(result.display_name);
    setSearchResults([]);
    setSearchError("");
    onSelect(coordinate);

    if (modalReady) {
      injectLocation(
        modalWebViewRef,
        coordinate.latitude,
        coordinate.longitude,
        true,
      );
    }
  };

  const waitForRouteRateLimit = async () => {
    const elapsed = Date.now() - lastRouteRequestAtRef.current;
    if (elapsed < PUBLIC_API_MIN_INTERVAL_MS) {
      await delay(PUBLIC_API_MIN_INTERVAL_MS - elapsed);
    }
    lastRouteRequestAtRef.current = Date.now();
  };

  const fetchRoute = async (
    mode: RideTravelMode,
    origin: RideMapCoordinate,
    destination: RideMapCoordinate,
    signal: AbortSignal,
  ): Promise<RouteInfo> => {
    await waitForRouteRateLimit();

    const serverProfile = mode === "walk" ? "routed-foot" : "routed-car";
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const endpoint = `https://routing.openstreetmap.de/${serverProfile}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=false&generate_hints=false`;

    const response = await fetch(endpoint, {
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Nookly-Mobile/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Route failed with status ${response.status}`);
    }

    const data = await response.json();
    const route = data?.routes?.[0];

    if (
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      route.geometry?.type !== "LineString" ||
      !Array.isArray(route.geometry?.coordinates)
    ) {
      throw new Error("No route was returned.");
    }

    return {
      mode,
      distanceMeters: Number(route.distance),
      durationSeconds: Number(route.duration),
      geometry: route.geometry as RouteGeometry,
    };
  };

  useEffect(() => {
    const destination = isValidCoordinate(selectedCoordinate)
      ? selectedCoordinate
      : null;

    if (!isExpanded || !userCoordinate || !destination) {
      setRoutes({});
      setRouteLoading(false);
      setRouteError("");
      return;
    }

    routeAbortControllerRef.current?.abort();
    const controller = new AbortController();
    routeAbortControllerRef.current = controller;
    const requestId = ++routeRequestIdRef.current;

    const loadRoutes = async () => {
      setRouteLoading(true);
      setRouteError("");
      setRoutes({});

      const nextRoutes: Partial<Record<RideTravelMode, RouteInfo>> = {};

      try {
        try {
          nextRoutes.drive = await fetchRoute(
            "drive",
            userCoordinate,
            destination,
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn("Driving route failed:", error);
        }

        try {
          nextRoutes.walk = await fetchRoute(
            "walk",
            userCoordinate,
            destination,
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn("Walking route failed:", error);
        }

        if (requestId !== routeRequestIdRef.current) return;

        setRoutes(nextRoutes);

        setActiveTravelMode((currentMode) => {
          if (nextRoutes[currentMode]) return currentMode;
          if (nextRoutes.drive) return "drive";
          return "walk";
        });

        if (!nextRoutes.drive && !nextRoutes.walk) {
          setRouteError("No walking or driving route could be calculated.");
        }
      } finally {
        if (requestId === routeRequestIdRef.current) {
          setRouteLoading(false);
        }
      }
    };

    void loadRoutes();

    return () => {
      controller.abort();
    };
  }, [
    isExpanded,
    selectedLatitude,
    selectedLongitude,
    userCoordinate?.latitude,
    userCoordinate?.longitude,
  ]);

  const openFullScreenMap = (focusNearbyDriverId?: string) => {
    pendingFocusDriverIdRef.current =
      focusNearbyDriverId?.trim() || null;
    setModalReady(false);
    setModalError("");
    setSearchResults([]);
    setSearchError("");
    setModalHtml(
      buildMapHtml({
        selectedCoordinate,
        darkMode,
        initialLayer: currentLayer,
        fullScreen: true,
      }),
    );
    setIsExpanded(true);

    if (!userCoordinate) {
      void refreshUserLocation(false);
    }
  };

  const closeFullScreenMap = () => {
    routeAbortControllerRef.current?.abort();
    setIsExpanded(false);
    setModalReady(false);
    setModalError("");
    setModalHtml("");
    setSearchResults([]);
  };

  const focusNearbyDriver = (driverId: string) => {
    const normalizedDriverId = driverId.trim();
    if (!normalizedDriverId) return;

    if (modalReady) {
      focusInjectedNearbyDriver(
        modalWebViewRef,
        normalizedDriverId,
      );
      return;
    }

    openFullScreenMap(normalizedDriverId);
  };

  useImperativeHandle(ref, () => ({
    openFullScreen: openFullScreenMap,
    closeFullScreen: closeFullScreenMap,
    focusNearbyDriver,
  }));

  const processMessage = (
    event: WebViewMessageEvent,
    source: "inline" | "modal",
  ) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as MapMessage;

      if (payload.type === "map-ready") {
        if (source === "inline") {
          setInlineReady(true);
          setInlineError("");
        } else {
          setModalReady(true);
          setModalError("");
        }
        return;
      }

      if (
        payload.type === "map-layer-changed" &&
        (payload.layer === "street" || payload.layer === "hybrid")
      ) {
        setCurrentLayer(payload.layer);

        if (source === "inline" && modalReady) {
          injectLayer(modalWebViewRef, payload.layer);
        }

        if (source === "modal" && inlineReady) {
          injectLayer(inlineWebViewRef, payload.layer);
        }
        return;
      }

      if (
        payload.type === "nearby-driver-selected" &&
        payload.driverId
      ) {
        onNearbyDriverPress?.(String(payload.driverId));
        return;
      }

      if (
        payload.type === "location-selected" &&
        Number.isFinite(payload.latitude) &&
        Number.isFinite(payload.longitude)
      ) {
        const coordinate = {
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
        };

        onSelect(coordinate);

        if (source === "inline" && modalReady) {
          injectLocation(
            modalWebViewRef,
            coordinate.latitude,
            coordinate.longitude,
          );
        }

        if (source === "modal" && inlineReady) {
          injectLocation(
            inlineWebViewRef,
            coordinate.latitude,
            coordinate.longitude,
          );
        }
      }
    } catch (error) {
      console.warn("Could not read map message:", error);
    }
  };

  const renderLoading = () => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: darkMode ? "#111827" : "#EEF2F7",
      }}
    >
      <ActivityIndicator size="small" />
      <Text
        style={{
          marginTop: 8,
          fontSize: 12,
          color: darkMode ? "#D1D5DB" : "#4B5563",
        }}
      >
        Loading map…
      </Text>
    </View>
  );

  const renderAttribution = () => (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 6,
        bottom: 6,
        zIndex: 4,
        maxWidth: "88%",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        backgroundColor: darkMode
          ? "rgba(15, 23, 42, 0.78)"
          : "rgba(255, 255, 255, 0.84)",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: darkMode ? "#E2E8F0" : "#334155",
          fontSize: 8,
          lineHeight: 10,
        }}
      >
        {currentLayer === "hybrid"
          ? "Imagery © Esri, Maxar and contributors"
          : "OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors"}
      </Text>
    </View>
  );

  const renderError = (message: string) => (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontSize: 13,
          color: darkMode ? "#FCA5A5" : "#B91C1C",
        }}
      >
        {message}
      </Text>
    </View>
  );

  const renderTravelCard = (mode: RideTravelMode) => {
    const route = routes[mode];
    const isActive = activeTravelMode === mode && Boolean(route);
    const isWalk = mode === "walk";

    const label = isWalk ? "Show walk route" : "Show vehicle route";
    const inactiveBorderColor = darkMode ? "#64748B" : "#94A3B8";
    const inactiveTextColor = darkMode ? "#CBD5E1" : "#64748B";
    const activeColor = "#2563EB";

    return (
      <View
        key={mode}
        style={{
          flex: 1,
          minWidth: 0,
          height: 90,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "transparent",
          borderWidth: isActive ? 2.5 : 1.5,
          borderColor: isActive ? activeColor : inactiveBorderColor,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.68}
          disabled={!route}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !route,
            selected: isActive,
          }}
          accessibilityLabel={
            route
              ? `${label}, ${formatDuration(
                  route.durationSeconds,
                )}, ${formatDistance(route.distanceMeters)}`
              : `${label}, unavailable`
          }
          onPress={() => setActiveTravelMode(mode)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: "transparent",
            opacity: route ? 1 : 0.45,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: isActive ? activeColor : inactiveTextColor,
              fontSize: 14,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            {label}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              marginTop: 7,
              color: isActive ? activeColor : inactiveTextColor,
              fontSize: 12,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            {route
              ? `${formatDuration(
                  route.durationSeconds,
                )} · ${formatDistance(route.distanceMeters)}`
              : routeLoading
                ? "Calculating route…"
                : "Route unavailable"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <View>
        <View
          style={{
            height,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: darkMode ? "#111827" : "#EEF2F7",
          }}
        >
          {!inlineReady && !inlineError ? renderLoading() : null}

          {inlineError ? (
            renderError(inlineError)
          ) : (
            <WebView
              ref={inlineWebViewRef}
              source={{ html: inlineHtml }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="never"
              setSupportMultipleWindows={false}
              onMessage={(event) => processMessage(event, "inline")}
              onError={(event) => {
                setInlineError(
                  event.nativeEvent.description ||
                    "The map could not be loaded.",
                );
              }}
              style={{ flex: 1, backgroundColor: "transparent" }}
            />
          )}

          {!inlineError ? renderAttribution() : null}
        </View>
      </View>

      <Modal
        visible={isExpanded}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={false}
        onRequestClose={closeFullScreenMap}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: darkMode ? "#0F172A" : "#FFFFFF",
          }}
        >
          <View
            style={{
              minHeight: 58,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: darkMode ? "#334155" : "#E5E7EB",
              backgroundColor: darkMode ? "#0F172A" : "#FFFFFF",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{
                  color: darkMode ? "#F8FAFC" : "#111827",
                  fontSize: 17,
                  fontWeight: "700",
                }}
              >
                Select destination
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: darkMode ? "#94A3B8" : "#64748B",
                  fontSize: 12,
                }}
              >
                Search, tap the map, or drag the marker
              </Text>
            </View>

            <Pressable
              onPress={closeFullScreenMap}
              style={({ pressed }) => ({
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: "#2563EB",
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 8,
              backgroundColor: darkMode ? "#0F172A" : "#FFFFFF",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TextInput
                value={searchQuery}
                onChangeText={(value) => {
                  setSearchQuery(value);
                  setSearchError("");
                }}
                onSubmitEditing={() => void runPlaceSearch()}
                placeholder="Search a place in Zimbabwe"
                placeholderTextColor={darkMode ? "#64748B" : "#94A3B8"}
                returnKeyType="search"
                autoCorrect={false}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderWidth: 1,
                  borderColor: darkMode ? "#334155" : "#CBD5E1",
                  borderRadius: 13,
                  paddingHorizontal: 14,
                  color: darkMode ? "#F8FAFC" : "#0F172A",
                  backgroundColor: darkMode ? "#111827" : "#F8FAFC",
                  fontSize: 14,
                }}
              />

              <Pressable
                disabled={searching}
                onPress={() => void runPlaceSearch()}
                style={({ pressed }) => ({
                  minWidth: 78,
                  minHeight: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 13,
                  paddingHorizontal: 14,
                  backgroundColor: darkMode ? "#F8FAFC" : "#111827",
                  opacity: searching ? 0.55 : pressed ? 0.78 : 1,
                })}
              >
                {searching ? (
                  <ActivityIndicator
                    size="small"
                    color={darkMode ? "#111827" : "#FFFFFF"}
                  />
                ) : (
                  <Text
                    style={{
                      color: darkMode ? "#111827" : "#FFFFFF",
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    Search
                  </Text>
                )}
              </Pressable>
            </View>

            {searchError ? (
              <Text
                style={{
                  marginTop: 7,
                  color: darkMode ? "#FCA5A5" : "#B91C1C",
                  fontSize: 12,
                }}
              >
                {searchError}
              </Text>
            ) : null}

            {searchResults.length ? (
              <View
                style={{
                  maxHeight: 210,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: darkMode ? "#334155" : "#E2E8F0",
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#111827" : "#FFFFFF",
                }}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {searchResults.map((result, index) => (
                    <Pressable
                      key={`${result.place_id}-${index}`}
                      onPress={() => chooseSearchResult(result)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 13,
                        paddingVertical: 11,
                        borderBottomWidth:
                          index === searchResults.length - 1 ? 0 : 1,
                        borderBottomColor: darkMode ? "#1E293B" : "#F1F5F9",
                        backgroundColor: pressed
                          ? darkMode
                            ? "#1E293B"
                            : "#F8FAFC"
                          : "transparent",
                      })}
                    >
                      <Text
                        numberOfLines={2}
                        style={{
                          color: darkMode ? "#F8FAFC" : "#0F172A",
                          fontSize: 13,
                          lineHeight: 18,
                          fontWeight: "600",
                        }}
                      >
                        {result.display_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    color: darkMode ? "#64748B" : "#94A3B8",
                    fontSize: 9,
                  }}
                >
                  Search data © OpenStreetMap contributors
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flex: 1,
              minHeight: 180,
              backgroundColor: darkMode ? "#111827" : "#EEF2F7",
            }}
          >
            {!modalReady && !modalError ? renderLoading() : null}

            {modalError ? (
              renderError(modalError)
            ) : modalHtml ? (
              <WebView
                ref={modalWebViewRef}
                source={{ html: modalHtml }}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="never"
                setSupportMultipleWindows={false}
                onMessage={(event) => processMessage(event, "modal")}
                onError={(event) => {
                  setModalError(
                    event.nativeEvent.description ||
                      "The map could not be loaded.",
                  );
                }}
                style={{ flex: 1, backgroundColor: "transparent" }}
              />
            ) : null}

            {!modalError && modalHtml ? renderAttribution() : null}
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: darkMode ? "#334155" : "#E2E8F0",
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 8,
              backgroundColor: darkMode ? "#0F172A" : "#FFFFFF",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 9,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text
                  style={{
                    color: darkMode ? "#F8FAFC" : "#0F172A",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  Directions and distance
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 2,
                    color: darkMode ? "#94A3B8" : "#64748B",
                    fontSize: 11,
                  }}
                >
                  Route arrows show travel direction
                </Text>
              </View>

              <Pressable
                disabled={locationLoading}
                onPress={() => {
                  if (userCoordinate && modalReady) {
                    injectUserLocation(
                      modalWebViewRef,
                      userCoordinate.latitude,
                      userCoordinate.longitude,
                      true,
                    );
                  } else {
                    void refreshUserLocation(true);
                  }
                }}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: darkMode ? "#4B9CD3" : "#CBD5E1",
                  borderRadius: 11,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: darkMode ? "#4B9CD3" : "#F8FAFC",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text
                    style={{
                      color: darkMode ? "#F8FAFC" : "#0F172A",
                      fontSize: 12,
                      fontWeight: "800",
                    }}
                  >
                    My location
                  </Text>
                )}
              </Pressable>
            </View>

            {locationError ? (
              <Text
                style={{
                  marginBottom: 8,
                  color: darkMode ? "#FCA5A5" : "#B91C1C",
                  fontSize: 11,
                  lineHeight: 15,
                }}
              >
                {locationError}
              </Text>
            ) : null}

            {!isValidCoordinate(selectedCoordinate) ? (
              <Text
                style={{
                  marginBottom: 8,
                  color: darkMode ? "#CBD5E1" : "#475569",
                  fontSize: 12,
                }}
              >
                Select a destination to calculate real road distances.
              </Text>
            ) : null}

            {routeError ? (
              <Text
                style={{
                  marginBottom: 8,
                  color: darkMode ? "#FCA5A5" : "#B91C1C",
                  fontSize: 11,
                }}
              >
                {routeError}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 9 }}>
              {renderTravelCard("walk")}
              {renderTravelCard("drive")}
            </View>

            <Text
              style={{
                marginTop: 6,
                color: darkMode ? "#64748B" : "#94A3B8",
                fontSize: 8.5,
                textAlign: "center",
              }}
            >
              Routes © OpenStreetMap contributors · Routing by FOSSGIS OSRM
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
});

export default RideLocationPickerMap;
