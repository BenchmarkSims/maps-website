// BMS Weather Routines
//
// Contains everything related to Weather reading and interpretation
//

//
// Version Data Offset Matrix
// Only map what is different between versions. This index into each array is the version.
//
const data_offset = {
    shower:     [0, 0, 0, 0, 0, 0,   ,0     ,0     , 93998 ],
    visibility: [0, 0, 0, 0, 0, 93998, 93998, 93998, 97479 ],
    fog:        [0, 0, 0, 0, 0, 0,   ,0     ,0     , 100960],
};

// Weather Data
var fmap = {
    time: "10000Z",
    version: 0,
    changed: false,
    scaler: 1,
    dimension: {x: 0, y:0},
    airmass: {direction: 0, speed: 0},
    turbulence: {top: 31000, bottom: 28000},
    contrail: [34000,28000,25000,2000],
    cells: 0,        // Total cells
    type: [],        // [y][x] 1: Sunny, 2: Fair, 3: Poor, 4: Inclement
    pressure: [],    // [y][x] hPa
    temperature: [], // [y][x] C
    wind: [],        // [y][x][alt] Direction and Speed in Kts at Altitudes (10 levels)
    cloud: {
        base: [],   // 0 .. 10000 ft
        cover:[],   // 1 = FEW, 5 = SCT, 9 = BKN, 13 = OVC
        size: [],   // 0: Largest ... 5 Smallest
        type: [],   // 0 Cumulus, 1 Cumulonimbus
    },
    shower: [],     // 0 No, 1 Yes
    visibility: [], // 0 .. 60 km
    fog: [],        // 0 .. 10000 ft

    // Analytics done on the data
    analytics: {
        pressure_min: 1060,
        pressure_max: 950,
        temperature_min: 50,
        temperature_max: -50
    }
};

function isIMC(x,y){
    // console.log(fmap.visibility[y][x], fmap.cloud.base[y][x]);
    return (fmap.version > 0 && (fmap.visibility[y][x] <= 3 || fmap.cloud.base[y][x] <= 4000));
}

//
// Create Simulated Doppler Data from Weather type, temperature, pressure, wind and cloud data
// These simulated radar returns are just simpleton guestimates
//
// Active Cells:
// - Low pressure areas below 1009 mb
// - Thundercells below 1004 mb
// - Extreme low pressure below 999 mb
// - Bonus score for high winds in these low presure areas
//
// Frontal zones are based on 10C delta per 20NM
// Tornado is 15% pressure drop with neighbors (Not Implemented)
// Snow is determined by looking at the surface temperature being at or below 0C.
function dopplerSense(x,y) {
    var wx = 0;

    if (fmap.type[y][x] == 4 || fmap.shower == 1) {
        wx++;
        if (fmap.pressure[y][x] < 1004) wx++;
        if (fmap.wind[x][y][0] > 20 ) wx++;
        if (fmap.cloud.type == 1 && fmap.cloud.size < 2) wx=+2;
    }

    // Check if is below zero C
    if (fmap.temperature[y][x] <= 0) wx = -wx;

    // Assign Weather to Radar
    return wx;
}

//
// FMAP Processing
//
function setTimeString(d,h,m) {
    var day_str = d.toFixed(0);
    var hrs_str = padZeros(h.toFixed(0),2);
    var min_str = padZeros(m.toFixed(0),2);

    fmap.time = day_str+hrs_str+min_str;
}

// Clear all current weather data
function clearWeather() {
    // Header Information
    fmap.version = 0;
    fmap.time = "10000Z",
    fmap.dimension.x = {x: 0, y: 0};
    fmap.airmass = {direction: 0, speed: 0};
    fmap.turbulence = {top: 31000, bottom: 28000};
    fmap.contrail = [34000,28000,25000,2000];
    fmap.cells = 0;

    // Weather Data
    fmap.type = [];
    fmap.pressure = [];
    fmap.temperature = [];
    fmap.wind = [];
    fmap.cloud.base = [];
    fmap.cloud.cover = [];
    fmap.cloud.size = [];
    fmap.cloud.type = [];
    fmap.shower = [];
    fmap.visibility = [];
    fmap.fog = [];
    fmap.analytics = {
        pressure_min: 1060,
        pressure_max: 950,
        temperature_min: 50,
        temperature_max: -50
    };
}

function readMapInfo(buffer) {
    let view = new Uint32Array(buffer);
    fmap.version           = view[0];
    fmap.dimension.x       = view[1];
    fmap.dimension.y       = view[2];
    fmap.airmass.direction = view[3];
    fmap.airmass.speed     = view[4];
    fmap.turbulence.top    = view[5];
    fmap.turbulence.bottom = view[6];
    fmap.contrail[0]       = view[7];
    fmap.contrail[1]       = view[8];
    fmap.contrail[2]       = view[9];
    fmap.contrail[3]       = view[10];

    // Compute total cells
    fmap.cells = fmap.dimension.x * fmap.dimension.y;
}

// Read the BMS Weather Type (1:Sunny, 2: Fair, 3: Poor, 4: Inclement)
function readWeatherType(buffer) {
    const offset = 11;
    let type = new Int32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseInt(type[offset + i]);
        }
        fmap.type.push(data);
    }
}

// Read the Atmopheric Pressure in mb / hPa
function readAtmosphericPressure(buffer) {

    const offset = 3492;
    let pressure = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(pressure[offset + i]);
            if (data[x] < fmap.analytics.pressure_min) fmap.analytics.pressure_min = data[x];
            if (data[x] > fmap.analytics.pressure_max) fmap.analytics.pressure_max = data[x];
        }
        fmap.pressure.push(data);
    }
}

// Read the Surface temperature in Celcius
function readSurfaceTemperature(buffer) {

    const offset = 6973;
    let temperature = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(temperature[offset + i]);
            if (data[x] < fmap.analytics.temperature_min) fmap.analytics.temperature_min = data[x];
            if (data[x] > fmap.analytics.temperature_max) fmap.analytics.temperature_max = data[x];
        }
        fmap.temperature.push(data);
    }
}

// Wind speed and direction for 10 altitudes:
// 0ft, 3000ft, 6000ft, 9000ft, 12000ft,
// 18000ft, 24000ft, 30000ft,
// 40000ft, 50000ft
function readWindVelocities(buffer) {

    const magnitude_offset = 10454;
    const direction_offset = 45264;
    const altitudes = 10;

    let winds = new Float32Array(buffer);

    // Iterate over the map cells
    for (var y=0;y < fmap.dimension.y; y++) {

        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {

            var velocities = Array(altitudes).fill(0);
            // Process the 10 altitudes for each weather Cell in BMS
            for (var alt = 0; alt < altitudes; alt++) {
                var i = y * fmap.dimension.x * altitudes + x * altitudes + alt;
                var speed = parseFloat(winds[magnitude_offset + i]);
                var direction = parseFloat(winds[direction_offset + i]);
                velocities[alt] = { direction: direction, speed: speed};
            }
            data[x] = velocities;
        }
        fmap.wind.push(data);
    }
}

// Read Cloud Base in Feet (Float)
function readCloudBase(buffer) {
    const offset = 80074;
    let cloud_data = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(cloud_data[offset + i]);
        }
        fmap.cloud.base.push(data);
    }
}

// Read Cloud Cover Data
// (1 FEW, 5 SCT, 9 BKN, 13 OVC)
// Weather Type Poor and Inclement should be minimum BKN.
function readCloudCover(buffer) {
    const offset = 83555;
    let cloud_cover = new Int32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseInt(cloud_cover[offset + i]);
        }
        fmap.cloud.cover.push(data);
    }
}

// Read Cloud Size (0 Largest .. 5 Smallest)
function readCloudSize(buffer) {
    const offset = 87036; // Cloud Size (checked)
    let cloud_size = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(cloud_size[offset + i]);
        }
        fmap.cloud.size.push(data);
    }
}

// Read Cloud Type
// Towering Cumulus (1 Yes, 0, No)
function readCloudType(buffer) {
    const offset = 90517; // Cloud Type
    let cloud_type = new Int32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseInt(cloud_type[offset + i]);
        }
        fmap.cloud.type.push(data);
    }
}

// Read Shower Data
// Showers (1 Yes, 0, No)
function readShowerdata(buffer) {
    const offset = data_offset.shower[fmap.version]; // (version 8 only)
    if (offset == 0) {
        fmap.shower = Array(fmap.cells).fill(0);
        return;
    }
    let shower = new Int32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseInt(shower[offset + i]);
        }
        fmap.shower.push(data);
    }
}

// Read Visibility 0 .. 60 km in Float
function readVisibility(buffer) {
    const offset = data_offset.visibility[fmap.version]; // Visibility LUT
    if (offset == 0) return;

    let visibility = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(visibility[offset + i]);
        }
        fmap.visibility.push(data);
    }
}

// Read Fog altitude level (in Feet Float)
function readFog(buffer) {
    const offset = data_offset.fog[fmap.version]; // Version 8 only;
    if (offset == 0) {
        fmap.fog = Array(fmap.cells).fill(0);
        return;
    }

    let fog = new Float32Array(buffer);

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var i = y * fmap.dimension.x + x;
            data[x] = parseFloat(fog[offset + i]);
        }
        fmap.fog.push(data);
    }
}

function padZeros(str,num) {
    while (str.length < num) str = "0" + str;
    return str;
}

function getOutsideAirTemp(x,y) {
    var oat = fmap.temperature[y][x];
    return oat;
}

function getPressure(x,y) {
    var qnh = fmap.pressure[y][x];
    return qnh;
}

function getWinds(x,y,idx) {
    var wind = fmap.wind[y][x][idx];
    return wind;
}

function getMETAR(x,y) {
    // fmap Guard
    if (fmap.version == 0 ) return "";

    // Initialize the METAR string
    var metar_str = "";

    // Check if fog data exists
    var hasFog = (isNaN(fmap.fog[y][x]) )?false:true;

    // Get METAR Time component
    var time_str = padZeros(fmap.time,6) + "Z";

    // Build the Wind String
    var wnd_dir = padZeros(Math.round(fmap.wind[y][x][0].direction).toString(),3);
    var wnd_spd = padZeros(Math.round(fmap.wind[y][x][0].speed).toString(),2);

   // Build the Visibility components
   var vis_str = "";
   var hasVisibility = (isNaN(fmap.visibility[y][x]))?false:true;
   var visibility = fmap.visibility[y][x] * 1000; // km to meters

   // If fog is present below 1000 then force visibility < 300 m
   if (hasFog && hasVisibility && fmap.fog[y][x] <= 300) if (visibility > 1000 ) visibility = 300;

   if (properties.settings.metric == true) {
        if ((visibility > 9999) || !hasVisibility) visibility = 9999;
        else visibility = Math.round(visibility / 100 ) * 100;
        vis_str = padZeros(visibility.toString(),4);
   }
   else {
        if ((visibility >= 16093.4) || !hasVisibility) vis_str = "10SM";
        else {
            vis_str = (Math.round(visibility / 1609.344)).toString();
            vis_str = padZeros(vis_str,2) + "SM";
            }
   }

   // Weather Component with Present Weather and Obscurations
   var wx_shower  = fmap.shower[y][x];
   var wx_type    = fmap.type[y][x];
   var wx_temp    = fmap.temperature[y][x];
   var cloud_type = fmap.cloud.type[y][x];
   var cloud_size = fmap.cloud.size[y][x];
   var wx_str = "";

   if (wx_type == 4) {
        // Rain Types
        if (wx_temp > 0) {
            if (wx_shower == 1) {
                if (cloud_type == 1 && cloud_size < 1) wx_str = "TSRA ";
                else wx_str = "SHRA ";
            }
            else {
                if (cloud_type == 1) wx_str = "+RA ";
                else wx_str = "RA ";
            }
        } // Snow Types
        else {
            if (wx_shower == 1) wx_str = "SN ";
            else wx_str = "FZRA ";
        }
   }

   // Add obscurations
   // Check for Fog and Mist
   if (hasFog && hasVisibility ) {
        if (fmap.fog[y][x] <= 300 && wx_type > 1) {
            // Check for fog
            if      (visibility < 1000 ) wx_str += (wx_temp < 0 )?"FZFG ":"FG ";
            else if (visibility < 5000 ) wx_str += "BR ";
        } else {
            // Check for Haze
            if (visibility < 5000 && wx_type < 4) wx_str += "HZ ";
        }
    }

   // Build Cloud Component
   var cld_str = "CLR";
   var cloud_cover = fmap.cloud.cover[y][x];
   var ceiling     = fmap.cloud.base[y][x];
   var fog         = fmap.fog[y][x];

   ceiling = (hasFog && fog < ceiling)?fog:ceiling;

   if (ceiling > 0 ) {
        var base = Math.round(ceiling / 100);
        var base_str = padZeros(base.toString(),3);
        if (cloud_cover > 0)  cld_str = "FEW" + base_str;
        if (cloud_cover >= 3) cld_str = "SCT" + base_str;
        if (cloud_cover >= 5) cld_str = "BKN" + base_str;
        if (cloud_cover >= 9) cld_str = "OVC" + base_str;
        if (cloud_type > 0 && cloud_cover > 0) cld_str += "CB";
    }

   // Build Temperature String
   var temp_str = "";
   var dew_str = "/";
   var temp = fmap.temperature[y][x];
   var base = (hasFog && fog > 0 && fog < ceiling)?fog:ceiling;
   var dew = (wx_type == 4)?fmap.temperature[y][x]:(temp - base/1000 * 1.2);

   // If sky clear assume RH = 50% then set dew accordingly
   // Td = T - ((100 - RH)/5.)
   // RH = 100 - 5(T - Td)
   // See Paper by Mark G. Lawrence
   if (cld_str.includes("CLR")) dew = temp - ((100 - 50)/5);

   // Temperature
   if (temp < 0) temp_str += "M";
   temp_str += padZeros(Math.round(Math.abs(temp)).toString(),2);

   // Dewpoint
   if (dew < 0) dew_str += "M";
   dew_str += padZeros(Math.round(Math.abs(dew)).toString(),2);

   // Build the Pressure String
   var baro_str = "";
   var baro = fmap.pressure[y][x];
   if (properties.settings.metric == true) baro_str = "Q" + padZeros((baro.toFixed(0)).toString(),4);
   else baro_str = "A" + (baro * 0.0295301 * 100).toFixed(0);

   // Build the METAR String
   metar_str += time_str + " " +
                wnd_dir + wnd_spd + "KT " +
                vis_str + " " +
                wx_str +
                cld_str + " " +
                temp_str + dew_str + " " +
                baro_str;

    return metar_str;
}

function updateAirportTitles(){
    var imageMap = document.getElementById("imgMap");
    var areas  = imageMap.children;

    // If there is no weather data then skip updating the Airport Titles
    if (fmap.version == 0 ) return;

    // Add the map entries to their option group
    const scalar = 65.08475;
    for (area of areas) {
        if (area.alt != "Legend" && area.alt != "Bullseye") {

            var coords = area.coords.split(",");
            var x = Math.floor((coords[0]/properties.zoom)/scalar) ;
            var y = Math.floor((coords[1]/properties.zoom)/scalar);
            var title = area.title.split(" METAR");
            var metar = getMETAR(x,y);
            area.title = title[0] + " METAR\n" + metar;
        }
    }
}

function fmapWriteValue(buf, offset, data) {
            buf[offset] = data;
}

function fmapWriteBlock(buf, offset, data) {
    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {
            buf[(y * fmap.dimension.x + x) + offset] = data[y][x];
        }
    }
}

function fmapWriteWndSpd(buf, offset, data) {
    const altitudes = 10;
    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {
            for (var alt = 0; alt < altitudes; alt++) {
                var i = offset + (y * fmap.dimension.x * altitudes + x * altitudes) + alt;
                buf[i] = data[y][x][alt].speed;
            }
        }
    }
}

function fmapWriteWndDir(buf, offset, data) {
    const altitudes = 10;
    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {
            for (var alt = 0; alt < altitudes; alt++) {
                var i = offset + (y * fmap.dimension.x * altitudes + x * altitudes) + alt;
                buf[i] = data[y][x][alt].direction;
            }
        }
    }
}

// buffer is a Uin32Array
function fmapExportData(buffer) {
    // Setup Views
    var bufUint32  = buffer;
    var bufFloat32 = new Float32Array(bufUint32.buffer);

    // Write Weather Type Data Version 8
    // Write the Header Values
    fmapWriteValue(bufUint32, 0,fmap.version);              // Version
    fmapWriteValue(bufUint32, 1,fmap.dimension.x);          // X dimension
    fmapWriteValue(bufUint32, 2,fmap.dimension.y);          // Y dimension

    // Basic Map Data
    fmapWriteValue(bufUint32,  3,fmap.airmass.direction);   // Map move Direction
    fmapWriteValue(bufFloat32, 4,fmap.airmass.speed);       // Map mov Speed in kts
    fmapWriteValue(bufUint32, 5,31000);                     // Turbulance Start?
    fmapWriteValue(bufUint32, 6,28000);                     // Turbulance End?

    // Use defaults
    fmapWriteValue(bufUint32, 7,34000);                     // Sunny Contrail layer
    fmapWriteValue(bufUint32, 8,28000);                     // Fair Contrail layer
    fmapWriteValue(bufUint32, 9,25000);                     // Poor Contrail Layer
    fmapWriteValue(bufUint32,10,20000);                     // Inclement Contrail Layer

    // Write the Data
    fmapWriteBlock(bufUint32,      11, fmap.type);          // [y][x] Weather Type
    fmapWriteBlock(bufFloat32,   3492, fmap.pressure);      // [y][x] Pressure Sea Level
    fmapWriteBlock(bufFloat32,   6973, fmap.temperature);   // [y][x] 2m Surface Temperature
    fmapWriteWndSpd(bufFloat32, 10454, fmap.wind);          // [y][x][alt] Wind speed
    fmapWriteWndDir(bufFloat32, 45264, fmap.wind);          // [y][x][alt] Wind Direction
    fmapWriteBlock(bufFloat32,  80074, fmap.cloud.base);    // [y][x] Cloud Ceiling
    fmapWriteBlock(bufUint32 ,  83555, fmap.cloud.cover);   // [y][x] Clouds Total Coverage
    fmapWriteBlock(bufFloat32,  87036, fmap.cloud.size);    // [y][x] Cloud size (0 large .. 5 small)
    fmapWriteBlock(bufUint32 ,  90517, fmap.cloud.type);    // [y][x] 0 Cumulus, 1 Cumulonimbus
    fmapWriteBlock(bufUint32 ,  93998, fmap.shower);        // [y][x] 0 No shower, 1 shower
    fmapWriteBlock(bufFloat32,  97479, fmap.visibility);    // [y][x] Visibility in km
    fmapWriteBlock(bufFloat32, 100960, fmap.fog);           // [y][x] Fog Altitude (low level/stratus clouds)
}

// Process the .fmap binary buffer
function processWeather(buffer) {
    clearWeather();

    // Set the Weather Time
    fmap.time = filename.split(".")[0];

    // Read the Weather Data from .fmap
    readMapInfo(buffer);
    readWeatherType(buffer);
    readAtmosphericPressure(buffer);
    readSurfaceTemperature(buffer);
    readWindVelocities(buffer);
    readCloudBase(buffer);
    readCloudCover(buffer);
    readCloudSize(buffer);
    readCloudType(buffer);
    readShowerdata(buffer);
    readVisibility(buffer);
    readFog(buffer);

    updateAirportTitles();

    // Tell the action layer weather has changed so it will redener the main canvas
    fmap.changed = true;
}
