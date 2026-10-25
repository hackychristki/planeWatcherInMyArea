# ✈️ PlaneWatcher

A small aircraft tracking app built to see what's flying around my area — **Altstätten, Switzerland**.

PlaneWatcher displays aircraft positions on an interactive map focused on Altstätten and the surrounding region. It fetches aircraft data from the OpenSky Network through a Node.js backend and displays it with Leaflet and OpenStreetMap tiles.

## What it does

- Loads aircraft automatically when the page opens.
- Requests updated positions every **15 seconds** while the tab is visible, skipping a refresh if the previous request is still running.
- Moves markers every second between refreshes, estimating positions from each aircraft's speed and heading.
- Places a marker on the map for each aircraft with valid coordinates.
- Shows the aircraft's callsign and altitude in metres when you click its marker.
- Lets you zoom and pan around the map.

## Saving OpenSky requests

Anonymous OpenSky access allows about 400 requests per day, so the app tries to use as few as possible:

- The backend caches the OpenSky response for 15 seconds. All tabs and devices share one upstream request.
- Hidden tabs don't poll at all.
- On a `429` response, the backend waits for the time in OpenSky's `X-Rate-Limit-Retry-After-Seconds` header (or 60 seconds) before trying again.
- If OpenSky fails or rate limits the app, the last cached data is returned instead of an error.

The backend terminal logs how many OpenSky credits remain. Change `CACHE_MS` in `backend/server.js` and `POLL_MS` in `frontend/model.js` to trade freshness for requests.

## Local coverage: Altstätten

The map starts at `47.38, 9.54` with zoom level `10`. Aircraft requests cover this fixed area around Altstätten:

| Boundary | Coordinate |
| --- | --- |
| South | 47.1° N |
| North | 47.6° N |
| West | 9.2° E |
| East | 9.9° E |

Panning the map does not change the area used to fetch aircraft. To track another region, update the bounds in `backend/server.js` and the initial map view in `frontend/model.js`.

## Run locally

You need Node.js with built-in `fetch` support and npm, plus an internet connection for aircraft data, map tiles, and Leaflet assets.

From the project root:

```bash
npm install --prefix backend
npm start --prefix backend
```

Open **http://127.0.0.1:3000** in your browser. Aircraft load automatically.

Keep the backend running while using the app. Open the HTTP address rather than opening `frontend/index.html` directly: Express serves both the page and the API from the same origin.

## How it works

1. Express serves the frontend from the `frontend` directory.
2. The browser requests `/api/v1/planes` every 15 seconds while the tab is visible.
3. The backend returns its cached response, or requests aircraft states from OpenSky for the configured region if the cache is older than 15 seconds.
4. The frontend updates existing markers, adds new aircraft and removes ones that left the area.
5. Between refreshes, markers move forward along their reported heading at their reported speed.

## Built with

| Component | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Interactive map | Leaflet |
| Map tiles | OpenStreetMap |
| Backend | Node.js and Express |
| Aircraft data | OpenSky Network |

## Project structure

```text
planeWatcher/
├── backend/
│   ├── server.js       # Static frontend hosting and aircraft API
│   ├── package.json    # Dependencies and start command
│   └── package-lock.json
├── frontend/
│   ├── index.html      # Page layout and map container
│   ├── model.js        # Map, aircraft markers, and automatic refresh
│   └── dist/           # Local map assets
├── .vscode/
│   └── launch.json     # Browser launch configuration
├── .gitignore
└── README.md
```

## Troubleshooting

- **The page does not open:** check that the backend is running on port `3000`.
- **An API request fails:** inspect the browser console and backend terminal for errors. The backend depends on OpenSky responding successfully.
- **No aircraft appear:** the response may contain no aircraft in the configured area; entries without valid coordinates are skipped.
- **Map tiles show “Access blocked”:** use the HTTP address above and check that your browser allows the referrer required by the OpenStreetMap tile service.

Aircraft data is provided by OpenSky Network. Map data © OpenStreetMap contributors.
