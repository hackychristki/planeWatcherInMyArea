//const { createElement } = require("react");

const map = L.map("map").setView([47.38, 9.54], 10);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const planeLayer = L.layerGroup().addTo(map);


function showPlanes(planes) {
  // Remove old markers when you load new data
  planeLayer.clearLayers();

  planes.forEach(plane => {
    // Skip aircraft without valid coordinates
    if (
      !Number.isFinite(plane.latitude) ||
      !Number.isFinite(plane.longitude)
    ) {
      return;
    }

    const marker = L.marker([
      plane.latitude,
      plane.longitude
    ]).addTo(planeLayer);

    const popup = document.createElement("div");
    popup.textContent =
      `${plane.callsign} — Altitude: ${plane.altitude ?? "Unknown"} m`;

    marker.bindPopup(popup);
  });
}



let isFetchingPlanes = false;

async function fetchPlanes(){
    if (isFetchingPlanes) return;
    isFetchingPlanes = true;

    try {
        const response = await fetch("/api/v1/planes")

        if(!response.ok){
            throw new Error("request failed")
        }

        const data = await response.json();
        console.log(data)   

        const planes = (data.states ?? []).map(plane => ({
            id: plane[0],
            callsign: plane[1]?.trim() || "Unknown",
            country: plane[2],
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



fetchPlanes();
setInterval(fetchPlanes, 2000);
