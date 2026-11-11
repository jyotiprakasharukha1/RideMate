
import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./LiveFleetMap.css";

export default function LiveFleetMap({
  location,
  trail = [],
  destination = null,
  allowDestination = false,
  onDestinationSelected,
  height = 500,
  title = "Live vehicle tracking"
}) {
  const mapElement = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef({
    vehicle: null,
    destination: null,
    trail: null,
    route: null
  });

  const [destinationQuery, setDestinationQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [routeError, setRouteError] = useState("");

  // Initialize Cesium 3D map with Esri World Imagery.
  // Use Cesium's ArcGIS provider rather than a raw URL template so that
  // the imagery tiling scheme and metadata are detected correctly.
  useEffect(() => {
    if (!mapElement.current || viewerRef.current) return;

    let cancelled = false;
    let resizeObserver;

    const viewer = new Cesium.Viewer(mapElement.current, {
      // Start without Cesium's default imagery layer. We add Esri explicitly.
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: true,
      selectionIndicator: true,
      shouldAnimate: true
    });

    viewerRef.current = viewer;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = true;

    const initializeImagery = async () => {
      try {
        const imageryProvider =
          await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            { enablePickFeatures: false }
          );

        if (cancelled || viewer.isDestroyed()) return;

        viewer.imageryLayers.addImageryProvider(imageryProvider);

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            85.8245,
            20.2961,
            12000
          ),
          duration: 1.5
        });
      } catch (error) {
        console.error("RideMate Cesium imagery initialization failed:", error);
        if (!cancelled) {
          setRouteError(
            "Satellite imagery could not be loaded. Check your internet connection and browser console."
          );
        }
      }
    };

    initializeImagery();

    resizeObserver = new ResizeObserver(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    });
    resizeObserver.observe(mapElement.current);

    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();

      if (!viewer.isDestroyed()) viewer.destroy();

      viewerRef.current = null;
      entitiesRef.current = {
        vehicle: null,
        destination: null,
        trail: null,
        route: null
      };
    };
  }, []);

  // Update live vehicle and GPS trail
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const position = Cesium.Cartesian3.fromDegrees(lng, lat);

    if (!entitiesRef.current.vehicle) {
      entitiesRef.current.vehicle = viewer.entities.add({
        name: "Customer live location",
        position,
        point: {
          pixelSize: 14,
          color: Cesium.Color.LIME,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: "LIVE VEHICLE",
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.DARKSLATEGRAY,
          pixelOffset: new Cesium.Cartesian2(0, -25)
        }
      });
    } else {
      entitiesRef.current.vehicle.position = position;
    }

    const points = (trail || [])
      .map((p) => [
        Number(p.longitude),
        Number(p.latitude)
      ])
      .filter(([lng, lat]) =>
        Number.isFinite(lng) && Number.isFinite(lat)
      );

    if (points.length > 1) {
      if (entitiesRef.current.trail) {
        viewer.entities.remove(entitiesRef.current.trail);
      }

      entitiesRef.current.trail = viewer.entities.add({
        name: "Actual travelled path",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(
            points.flat()
          ),
          width: 5,
          material: Cesium.Color.ORANGE,
          clampToGround: true
        }
      });
    }

    // Focus camera on vehicle on first GPS update
    if (!viewer._rideMateCentered) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          lng,
          lat,
          2500
        ),
        duration: 1.5
      });

      viewer._rideMateCentered = true;
    }
  }, [location, trail]);

  // Update destination marker
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (
      !destination ||
      !Number.isFinite(Number(destination.latitude)) ||
      !Number.isFinite(Number(destination.longitude))
    ) return;

    const position = Cesium.Cartesian3.fromDegrees(
      Number(destination.longitude),
      Number(destination.latitude)
    );

    if (!entitiesRef.current.destination) {
      entitiesRef.current.destination = viewer.entities.add({
        name: destination.name || "Destination",
        position,
        point: {
          pixelSize: 13,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        },
        label: {
          text: "DESTINATION",
          font: "13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.DARKRED,
          pixelOffset: new Cesium.Cartesian2(0, -25)
        }
      });
    } else {
      entitiesRef.current.destination.position = position;
      entitiesRef.current.destination.name =
        destination.name || "Destination";
    }
  }, [destination]);

  // Load planned driving route
  useEffect(() => {
    let cancelled = false;

    const viewer = viewerRef.current;

    if (!viewer || !location || !destination) return;

    const fromLat = Number(location.latitude);
    const fromLng = Number(location.longitude);
    const toLat = Number(destination.latitude);
    const toLng = Number(destination.longitude);

    if (
      ![fromLat, fromLng, toLat, toLng].every(Number.isFinite)
    ) return;

    const loadRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${fromLng},${fromLat};${toLng},${toLat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Route service unavailable");
        }

        const data = await response.json();

        if (cancelled || !data.routes?.[0]) {
          throw new Error("No driving route found");
        }

        const coordinates =
          data.routes[0].geometry.coordinates.flat();

        if (entitiesRef.current.route) {
          viewer.entities.remove(entitiesRef.current.route);
        }

        entitiesRef.current.route = viewer.entities.add({
          name: "Planned driving route",
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(
              coordinates
            ),
            width: 5,
            material: Cesium.Color.DODGERBLUE,
            clampToGround: true
          }
        });
      } catch {
        if (!cancelled) {
          setRouteError(
            "Planned route could not be loaded. Live GPS will still work."
          );
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    location?.latitude,
    location?.longitude,
    destination?.latitude,
    destination?.longitude
  ]);

  // Destination search
  const findDestination = async (event) => {
    event.preventDefault();

    if (!destinationQuery.trim()) return;

    setSearching(true);
    setRouteError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(destinationQuery.trim())}`
      );

      if (!response.ok) {
        throw new Error("Destination search is unavailable.");
      }

      const results = await response.json();

      if (!results.length) {
        throw new Error(
          "Destination not found. Try a nearby landmark or full address."
        );
      }

      const place = results[0];

      const selected = {
        name: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon)
      };

      onDestinationSelected?.(selected);

      setDestinationQuery(
        place.display_name.split(",").slice(0, 2).join(",")
      );

      const viewer = viewerRef.current;

      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            selected.longitude,
            selected.latitude,
            3000
          ),
          duration: 1.5
        });
      }
    } catch (error) {
      setRouteError(error.message || "Could not find destination.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="ridemate-live-map-card">
      <div className="ridemate-live-map-heading">
        <div>
          <span className="ridemate-map-eyebrow">
            RIDEMATE LIVE FLEET
          </span>
          <h3>{title}</h3>
        </div>

        <span className="ridemate-live-indicator">
          <i /> LIVE GPS
        </span>
      </div>

      {allowDestination && (
        <form
          className="ridemate-destination-form"
          onSubmit={findDestination}
        >
          <input
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            placeholder="Enter destination (e.g. Puri Beach)"
            aria-label="Destination"
          />

          <button type="submit" disabled={searching}>
            {searching ? "Searching..." : "Set destination"}
          </button>
        </form>
      )}

      <div
        ref={mapElement}
        className="ridemate-leaflet-map ridemate-cesium-map"
        style={{ height, width: "100%" }}
      />

      <div className="ridemate-map-legend">
        <span><i className="legend-customer" /> Customer live location</span>
        <span><i className="legend-trail" /> Actual travelled path</span>
        <span><i className="legend-route" /> Planned route</span>
        <span><i className="legend-destination" /> Destination</span>
      </div>

      {destination && (
        <p className="ridemate-map-destination">
          Destination: {destination.name}
        </p>
      )}

      {routeError && (
        <p className="ridemate-map-error">{routeError}</p>
      )}

      {!location && (
        <p className="ridemate-map-waiting">
          Waiting for the customer to enable GPS sharing...
        </p>
      )}
    </div>
  );
}
