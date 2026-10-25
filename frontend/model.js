//const { createElement } = require("react");

const map = L.map("map").setView([47.38, 9.54], 10);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const planeLayer = L.layerGroup().addTo(map);

// OpenSky only updates every 5-10s anyway, the animation fills the gaps
const POLL_MS = 15000;
const ANIMATE_MS = 1000;
// don't guess positions further ahead than this
const MAX_EXTRAPOLATE_S = 60;
const METERS_PER_DEGREE = 111320;

// id -> { marker, popup, plane }
const planeMarkers = new Map();


function popupText(plane) {
  return `${plane.callsign} — Altitude: ${plane.altitude ?? "Unknown"} m`;
}

// moves the last known position forward using speed and heading
function estimatePosition(plane) {
  if (
    plane.onGround ||
    !Number.isFinite(plane.speed) ||
    !Number.isFinite(plane.direction) ||
    !Number.isFinite(plane.timePosition)
  ) {
    return [plane.latitude, plane.longitude];
  }

  const elapsed = Math.min(
    Math.max(Date.now() / 1000 - plane.timePosition, 0),
    MAX_EXTRAPOLATE_S
  );
  const distance = plane.speed * elapsed;
  const heading = plane.direction * Math.PI / 180;

  const dLat = distance * Math.cos(heading) / METERS_PER_DEGREE;
  const dLon = distance * Math.sin(heading) /
    (METERS_PER_DEGREE * Math.cos(plane.latitude * Math.PI / 180));

  return [plane.latitude + dLat, plane.longitude + dLon];
}

function showPlanes(planes) {
  const seen = new Set();

  planes.forEach(plane => {
    // Skip aircraft without valid coordinates
    if (
      !Number.isFinite(plane.latitude) ||
      !Number.isFinite(plane.longitude)
    ) {
      return;
    }

    seen.add(plane.id);
    const existing = planeMarkers.get(plane.id);

    // Update markers in place so open popups stay open
    if (existing) {
      existing.plane = plane;
      existing.popup.textContent = popupText(plane);
      existing.marker.setLatLng(estimatePosition(plane));
      return;
    }

    const marker = L.marker(estimatePosition(plane)).addTo(planeLayer);

    const popup = document.createElement("div");
    popup.textContent = popupText(plane);

    marker.bindPopup(popup);
    planeMarkers.set(plane.id, { marker, popup, plane });
  });

  // Remove aircraft that left the area
  planeMarkers.forEach((entry, id) => {
    if (!seen.has(id)) {
      planeLayer.removeLayer(entry.marker);
      planeMarkers.delete(id);
    }
  });
}

function animatePlanes() {
  if (document.hidden) return;

  planeMarkers.forEach(entry => {
    entry.marker.setLatLng(estimatePosition(entry.plane));
  });
}



let isFetchingPlanes = false;

async function fetchPlanes(){
    // Background tabs don't spend any requests
    if (document.hidden) return;
    if (isFetchingPlanes) return;
    isFetchingPlanes = true;

    try {
        const response = await fetch("/api/v1/planes")

        if(!response.ok){
            throw new Error("request failed")
        }

        const data = await response.json();
        //console.log(data)

        const planes = (data.states ?? []).map(plane => ({
            id: plane[0],
            callsign: plane[1]?.trim() || "Unknown",
            country: plane[2],
            timePosition: plane[3],
            longitude: plane[5],
            latitude: plane[6],
            altitude: plane[7],
            onGround: plane[8],
            speed: plane[9],
            direction: plane[10]
        }));

        showPlanes(planes)




    } catch (error) {
        console.error(error)
    } finally {
        isFetchingPlanes = false;
    }

}



// Refresh right away when the tab comes back into view
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchPlanes();
});

fetchPlanes();
setInterval(fetchPlanes, POLL_MS);
setInterval(animatePlanes, ANIMATE_MS);
