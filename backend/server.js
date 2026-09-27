const express = require("express");
const path = require("node:path");
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/v1/planes", async(req, res) =>{
    try {
        
        const url = 'https://opensky-network.org/api/states/all' +'?lamin=47.1&lomin=9.2&lamax=47.6&lomax=9.9';

        const response = await fetch(url);

        if(!response.ok){
            return res.status(response.status).json({
                status: response.status,
                message: "failed for some reason"
            })
        }

        const data = await response.json();
        res.json(data);


    } catch (error) {
        console.error(error);
        res.status(502).json({
            message: "couldnt reach OpenSky"
        })
    }
})

app.listen(port, function(){
    console.log("Open PlaneWatcher at http://127.0.0.1:" + port)
})
