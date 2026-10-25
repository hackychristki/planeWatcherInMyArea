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

// id -> { marker, popup, icon, plane }
const planeMarkers = new Map();

const PLANE_SVG =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
  '<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>' +
  '</svg>';


// The SVG points north, so rotating by the heading points it where the plane flies
function updateIcon(icon, plane) {
  const heading = Number.isFinite(plane.direction) ? plane.direction : 0;

  // Turn the short way, e.g. 350° -> 10° rotates 20° instead of back 340°
  const current = Number(icon.dataset.rotation ?? heading);
  const delta = ((heading - current) % 360 + 540) % 360 - 180;
  const rotation = current + delta;

  icon.dataset.rotation = rotation;
  icon.style.transform = `rotate(${rotation}deg)`;
  icon.classList.toggle("on-ground", Boolean(plane.onGround));
}

function createPlaneIcon(plane) {
  const icon = document.createElement("div");
  icon.className = "plane-icon";
  icon.innerHTML = PLANE_SVG;
  updateIcon(icon, plane);

  return {
    icon,
    leafletIcon: L.divIcon({
      html: icon,
      className: "plane-marker",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    })
  };
}


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
      updateIcon(existing.icon, plane);
      existing.marker.setLatLng(estimatePosition(plane));
      return;
    }

    const { icon, leafletIcon } = createPlaneIcon(plane);
    const marker = L.marker(estimatePosition(plane), { icon: leafletIcon }).addTo(planeLayer);

    const popup = document.createElement("div");
    popup.textContent = popupText(plane);

    marker.bindPopup(popup);
    planeMarkers.set(plane.id, { marker, popup, icon, plane });
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
