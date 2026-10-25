const express = require("express");
const path = require("node:path");
const app = express();
const port = 3000;

const OPENSKY_URL = 'https://opensky-network.org/api/states/all' +'?lamin=47.1&lomin=9.2&lamax=47.6&lomax=9.9';

// OpenSky is asked at most once per CACHE_MS, no matter how many tabs are open
const CACHE_MS = 15000;
// used when a 429 comes back without a retry header
const DEFAULT_BACKOFF_MS = 60000;

let cache = { data: null, time: 0 };
let blockedUntil = 0;
let pendingRequest = null;

async function requestOpenSky(){
    const response = await fetch(OPENSKY_URL);

    if(response.status === 429){
        const retryAfter = Number(response.headers.get("X-Rate-Limit-Retry-After-Seconds"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : DEFAULT_BACKOFF_MS;
        blockedUntil = Date.now() + waitMs;
        console.warn(`OpenSky rate limit hit, pausing requests for ${Math.round(waitMs / 1000)}s`);
    }

    if(!response.ok){
        const error = new Error("OpenSky responded with " + response.status);
        error.status = response.status;
        throw error;
    }

    const remaining = response.headers.get("X-Rate-Limit-Remaining");
    if(remaining !== null){
        console.log("OpenSky credits remaining: " + remaining);
    }

    const data = await response.json();
    cache = { data, time: Date.now() };
    return data;
}

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/v1/planes", async(req, res) =>{
    const now = Date.now();

    if(cache.data && now - cache.time < CACHE_MS){
        return res.json(cache.data);
    }

    if(now < blockedUntil){
        if(cache.data) return res.json(cache.data);
        return res.status(429).json({
            status: 429,
            message: "rate limited by OpenSky, try again later"
        })
    }

    try {
        // requests arriving while one is already in flight share it
        pendingRequest ??= requestOpenSky().finally(() => { pendingRequest = null; });
        const data = await pendingRequest;
        res.json(data);

    } catch (error) {
        console.error(error);

        // old positions are better than an empty map
        if(cache.data) return res.json(cache.data);

        if(error.status){
            return res.status(error.status).json({
                status: error.status,
                message: "failed for some reason"
            })
        }

        res.status(502).json({
            message: "couldnt reach OpenSky"
        })
    }
})

app.listen(port, function(){
    console.log("Open PlaneWatcher at http://127.0.0.1:" + port)
})
