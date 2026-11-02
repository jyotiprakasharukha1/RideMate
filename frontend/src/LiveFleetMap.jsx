import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./LiveFleetMap.css";

const pin = (kind) => L.divIcon({
  className: "ridemate-map-pin-wrap",
  html: `<div class="ridemate-map-pin ${kind}">${kind === "destination" ? "◆" : kind === "start" ? "S" : "●"}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

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
  const mapRef = useRef(null);
  const currentMarker = useRef(null);
  const destinationMarker = useRef(null);
  const trailLine = useRef(null);
  const plannedLine = useRef(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, { zoomControl: true }).setView([20.2961, 85.8245], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    setTimeout(resize, 100);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const point = [lat, lng];
      if (!currentMarker.current) currentMarker.current = L.marker(point, { icon: pin("vehicle") }).addTo(map).bindPopup("Customer's live location");
      else currentMarker.current.setLatLng(point);
      if (trailLine.current) trailLine.current.remove();
      const points = (trail || []).map((p) => [Number(p.latitude), Number(p.longitude)]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (points.length > 1) trailLine.current = L.polyline(points, { color: "#ff7a36", weight: 5, opacity: 0.9 }).addTo(map);
      if (!map._ridemateCentered) {
        map.setView(point, 15);
        map._ridemateCentered = true;
      }
    }
    if (destination && Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude))) {
      const dest = [Number(destination.latitude), Number(destination.longitude)];
      if (!destinationMarker.current) destinationMarker.current = L.marker(dest, { icon: pin("destination") }).addTo(map).bindPopup(destination.name || "Destination");
      else destinationMarker.current.setLatLng(dest).bindPopup(destination.name || "Destination");
    }
  }, [location, trail, destination]);

  useEffect(() => {
    let cancelled = false;
    const map = mapRef.current;
    if (!map || !location || !destination) return;
    const fromLat = Number(location.latitude), fromLng = Number(location.longitude);
    const toLat = Number(destination.latitude), toLng = Number(destination.longitude);
    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) return;
    fetch(`https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.routes?.[0]) return;
        if (plannedLine.current) plannedLine.current.remove();
        const latLngs = data.routes[0].geometry.coordinates.map(([x, y]) => [y, x]);
        plannedLine.current = L.polyline(latLngs, { color: "#42a5ff", weight: 5, opacity: 0.85, dashArray: "10 8" }).addTo(map);
      })
      .catch(() => setRouteError("Planned route could not be loaded. The live GPS trail will still work."));
    return () => { cancelled = true; };
  }, [location?.latitude, location?.longitude, destination?.latitude, destination?.longitude]);

  const findDestination = async (event) => {
    event.preventDefault();
    if (!destinationQuery.trim()) return;
    setSearching(true);
    setRouteError("");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(destinationQuery.trim())}`);
      const results = await response.json();
      if (!results.length) throw new Error("Destination not found. Try a nearby landmark or full address.");
      const place = results[0];
      const selected = { name: place.display_name, latitude: Number(place.lat), longitude: Number(place.lon) };
      onDestinationSelected?.(selected);
      setDestinationQuery(place.display_name.split(",").slice(0, 2).join(","));
    } catch (error) {
      setRouteError(error.message || "Could not find destination.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="ridemate-live-map-card">
      <div className="ridemate-live-map-heading">
        <div><span className="ridemate-map-eyebrow">RIDEMATE LIVE FLEET</span><h3>{title}</h3></div>
        <span className="ridemate-live-indicator"><i /> LIVE GPS</span>
      </div>
      {allowDestination && (
        <form className="ridemate-destination-form" onSubmit={findDestination}>
          <input value={destinationQuery} onChange={(e) => setDestinationQuery(e.target.value)} placeholder="Enter destination (e.g. Puri Beach)" aria-label="Destination" />
          <button type="submit" disabled={searching}>{searching ? "Searching..." : "Set destination"}</button>
        </form>
      )}
      <div ref={mapElement} className="ridemate-leaflet-map" style={{ height }} />
      <div className="ridemate-map-legend">
        <span><i className="legend-customer" /> Customer live location</span>
        <span><i className="legend-trail" /> Actual travelled path</span>
        <span><i className="legend-route" /> Planned route</span>
        <span><i className="legend-destination" /> Destination</span>
      </div>
      {destination && <p className="ridemate-map-destination">Destination: {destination.name}</p>}
      {routeError && <p className="ridemate-map-error">{routeError}</p>}
      {!location && <p className="ridemate-map-waiting">Waiting for the customer to enable GPS sharing...</p>}
    </div>
  );
}
