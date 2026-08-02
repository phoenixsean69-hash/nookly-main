import type { POI } from "@/lib/poiService";

export type PropertyMapType = "street" | "hybrid";

export interface PropertyMapRoute {
  coordinates: [number, number][];
  distanceKm?: number;
  durationMinutes?: number;
}

interface BuildPropertyMapHtmlOptions {
  propertyLatitude: number;
  propertyLongitude: number;
  propertyName?: string;
  pois?: POI[];
  selectedPOIId?: string | null;
  route?: PropertyMapRoute | null;
  categoryColor?: string;
  initialZoom?: number;
  initialMapType?: PropertyMapType;
  showMapTypeToggle?: boolean;
}

const serializeForHtml = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export const buildPropertyMapHtml = ({
  propertyLatitude,
  propertyLongitude,
  propertyName = "Property",
  pois = [],
  selectedPOIId = null,
  route = null,
  categoryColor = "#2563EB",
  initialZoom = 15,
  initialMapType = "street",
  showMapTypeToggle = true,
}: BuildPropertyMapHtmlOptions): string => {
  const property = {
    latitude: propertyLatitude,
    longitude: propertyLongitude,
    name: propertyName,
  };

  const safePOIs = pois.map((poi) => ({
    id: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    distanceKm: poi.distanceKm,
    address: poi.address || "",
    selected: poi.id === selectedPOIId,
  }));

  const routeCoordinates = route?.coordinates ?? [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #E5E7EB;
    }

    .leaflet-control-attribution {
      font-size: 9px;
    }

    .map-type-control {
      display: flex;
      align-items: center;
      overflow: hidden;
      padding: 3px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(17, 24, 39, 0.13);
      box-shadow: 0 2px 9px rgba(0, 0, 0, 0.2);
      font-family: Arial, sans-serif;
    }

    .map-type-button {
      appearance: none;
      border: 0;
      outline: none;
      min-width: 58px;
      height: 31px;
      padding: 0 9px;
      border-radius: 7px;
      background: transparent;
      color: #374151;
      font-size: 11px;
      font-weight: 700;
    }

    .map-type-button.active {
      background: #FF4B33;
      color: #FFFFFF;
    }

    .property-marker {
      width: 34px;
      height: 34px;
      border-radius: 17px 17px 17px 3px;
      transform: rotate(-45deg);
      background: #FF4B33;
      border: 3px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.28);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .property-marker span {
      transform: rotate(45deg);
      color: #FFFFFF;
      font-size: 16px;
      line-height: 1;
    }

    .poi-marker {
      width: 28px;
      height: 28px;
      border-radius: 14px;
      border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 700;
      font-family: Arial, sans-serif;
      font-size: 11px;
    }

    .poi-marker.selected {
      width: 36px;
      height: 36px;
      border-radius: 18px;
      font-size: 13px;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.38);
    }

    .popup-title {
      font-family: Arial, sans-serif;
      font-weight: 700;
      margin-bottom: 4px;
      color: #111827;
    }

    .popup-meta {
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #4B5563;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const property = ${serializeForHtml(property)};
    const pois = ${serializeForHtml(safePOIs)};
    const routeCoordinates = ${serializeForHtml(routeCoordinates)};
    const categoryColor = ${serializeForHtml(categoryColor)};
    const initialZoom = ${serializeForHtml(initialZoom)};
    const requestedMapType = ${serializeForHtml(initialMapType)};
    const showMapTypeToggle = ${serializeForHtml(showMapTypeToggle)};

    const map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
    });

    const streetLayer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }
    );

    const hybridImageryLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri",
      }
    );

    const hybridLabelsLayer = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        pane: "overlayPane",
      }
    );

    let activeMapType =
      requestedMapType === "hybrid" ? "hybrid" : "street";
    let streetButton = null;
    let hybridButton = null;

    function updateMapTypeButtons() {
      if (!streetButton || !hybridButton) return;

      streetButton.classList.toggle(
        "active",
        activeMapType === "street"
      );
      hybridButton.classList.toggle(
        "active",
        activeMapType === "hybrid"
      );
    }

    function applyMapType(nextType) {
      activeMapType = nextType === "hybrid" ? "hybrid" : "street";

      [streetLayer, hybridImageryLayer, hybridLabelsLayer].forEach(
        (layer) => {
          if (map.hasLayer(layer)) map.removeLayer(layer);
        }
      );

      if (activeMapType === "hybrid") {
        hybridImageryLayer.addTo(map);
        hybridLabelsLayer.addTo(map);
      } else {
        streetLayer.addTo(map);
      }

      updateMapTypeButtons();
    }

    applyMapType(activeMapType);

    if (showMapTypeToggle) {
      const MapTypeControl = L.Control.extend({
        options: { position: "topright" },

        onAdd: function () {
          const container = L.DomUtil.create(
            "div",
            "map-type-control"
          );

          streetButton = L.DomUtil.create(
            "button",
            "map-type-button",
            container
          );
          streetButton.type = "button";
          streetButton.textContent = "Street";

          hybridButton = L.DomUtil.create(
            "button",
            "map-type-button",
            container
          );
          hybridButton.type = "button";
          hybridButton.textContent = "Hybrid";

          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);

          L.DomEvent.on(streetButton, "click", function (event) {
            L.DomEvent.stop(event);
            applyMapType("street");
          });

          L.DomEvent.on(hybridButton, "click", function (event) {
            L.DomEvent.stop(event);
            applyMapType("hybrid");
          });

          updateMapTypeButtons();
          return container;
        },
      });

      map.addControl(new MapTypeControl());
    }

    const propertyIcon = L.divIcon({
      className: "",
      html: '<div class="property-marker"><span>⌂</span></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 35],
      popupAnchor: [0, -34],
    });

    const propertyMarker = L.marker(
      [property.latitude, property.longitude],
      { icon: propertyIcon, zIndexOffset: 1000 }
    )
      .addTo(map)
      .bindPopup(
        '<div class="popup-title">' + escapeHtml(property.name) + '</div>' +
        '<div class="popup-meta">Property location</div>'
      );

    const bounds = L.latLngBounds([
      [property.latitude, property.longitude],
    ]);

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function sendToApp(payload) {
      if (
        window.ReactNativeWebView &&
        typeof window.ReactNativeWebView.postMessage === "function"
      ) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    pois.forEach((poi, index) => {
      const markerClass = poi.selected
        ? "poi-marker selected"
        : "poi-marker";

      const markerIcon = L.divIcon({
        className: "",
        html:
          '<div class="' + markerClass + '" style="background:' +
          categoryColor +
          '">' +
          (index + 1) +
          '</div>',
        iconSize: poi.selected ? [40, 40] : [32, 32],
        iconAnchor: poi.selected ? [20, 20] : [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker(
        [poi.latitude, poi.longitude],
        {
          icon: markerIcon,
          zIndexOffset: poi.selected ? 900 : 100,
        }
      )
        .addTo(map)
        .bindPopup(
          '<div class="popup-title">' + escapeHtml(poi.name) + '</div>' +
          '<div class="popup-meta">' +
          Number(poi.distanceKm || 0).toFixed(1) +
          ' km from the property' +
          (poi.address
            ? '<br />' + escapeHtml(poi.address)
            : '') +
          '</div>'
        );

      marker.on("click", () => {
        sendToApp({ type: "poi-pressed", poiId: poi.id });
      });

      if (poi.selected) {
        marker.openPopup();
      }

      bounds.extend([poi.latitude, poi.longitude]);
    });

    if (Array.isArray(routeCoordinates) && routeCoordinates.length > 1) {
      const routeLine = L.polyline(routeCoordinates, {
        color: "#FF4B33",
        weight: 6,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      bounds.extend(routeLine.getBounds());
    }

    if (bounds.isValid() && (pois.length > 0 || routeCoordinates.length > 1)) {
      map.fitBounds(bounds, {
        padding: [34, 34],
        maxZoom: 16,
      });
    } else {
      map.setView(
        [property.latitude, property.longitude],
        initialZoom
      );
    }

    setTimeout(() => map.invalidateSize(), 250);
  </script>
</body>
</html>`;
};
