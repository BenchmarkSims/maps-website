//
// Math and Utility functions for Falcon BMS Interactive Maps
//
// This file should not depend on anything else excpet core JS datatypes and functions
//
const PX2NM = 6.95; // Based on 3840 for maps/

// Given two points return a vector with length and direction
function vector(point1, point2){
    var magnitude = Math.sqrt(Math.pow(point2.x-point1.x,2) + Math.pow(point2.y-point1.y,2));
    var direction = Math.atan2(point2.x - point1.x, point2.y - point1.y);
    return { magnitude: magnitude , direction: direction};
}

// Compute the distance between two points
function distance(point1, point2){
    var magnitude = Math.sqrt(Math.pow(point2.x-point1.x,2) + Math.pow(point2.y-point1.y,2));
    return magnitude;
}

// Given a Vector
function vec2XY(vector){
    var x = vector.magnitude * Math.cos(vector.direction);
    var y = vector.magnitude * Math.sin(vector.direction);
    return {x: x, y: y};
}

// Convert Radians to Degrees Heading
function rad2deg(rad) {
    var degrees = Math.round(Math.abs((rad * 57.2958) -180));
    if (degrees == 0 ) degrees = 360;
    return degrees;
}

// Convert Degrees to radians
function deg2rad(deg) {
    var rad = deg / 57.2958;
    return rad;
}

// Determine midpoint bewteen two points
function midpoint(point1, point2) {
    return {x: (point1.x + point2.x)/2 , y: (point1.y + point2.y)/2 };
}

function offsetToLatLon(lat0, lon0, xOffsetFt, yOffsetFt) {
    // Constants
    const R = 6378137; // Earth radius in meters
    const deg2rad = Math.PI / 180; // Degrees to radians conversion
    const ftToM = 0.3048; // Feet to meters conversion
    const metersPerDegreeLat = 111120; // Approximate meters per degree of latitude

    // Convert offsets from feet to meters with latitude correction
    const xM = xOffsetFt * ftToM;
    const yM = yOffsetFt * ftToM * 1.065; // Empirical correction for 0.910716° latitude error

    // Estimate target latitude for longitude correction
    const deltaLat = yM / metersPerDegreeLat; // Approximate latitude change in degrees
    const latEst = lat0 + deltaLat; // Estimated target latitude
    const scale = (1 / Math.cos(latEst * deg2rad)) * 1.002; // Longitude scale with correction for 0.710367° error

    const xMCorrected = xM * scale;

    // Convert origin (lat0, lon0) to Web Mercator coordinates
    const x0 = R * lon0 * deg2rad;
    const y0 = R * Math.log(Math.tan(Math.PI / 4 + lat0 * deg2rad / 2));

    // Apply corrected offsets
    const x = x0 + xMCorrected;
    const y = y0 + yM;

    // Convert back to latitude and longitude
    const lon = x / (R * deg2rad);
    const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / deg2rad;

    return { lat, lon };
}

/* Covert to Lat and Long from ft offset coordinates
 *
 * in datum:    degrees Latitude and Longitude of left bottom map corner
 * in location: point with x and y in feet.
 * returns: Point with Latitude and Longitude
 * 
 * Version 2 is using the New Terrain and so Mercator project This needs a different
 * Conversion Method. Here it uses a simplified approach based on the Krüger series
 */
function map2LatLong(datum,location) {
    const FT_PER_DEG = 365221.8846;
    const RAD_TO_DEG = 57.2957795;
    const DEG_TO_RAD = 0.01745329;
    const R_EARTH_FT = 20925700;
    const KM_TO_FT   = 3280.8399;

    var coordLat = 0.0;
    var coordLong = 0.0;
    if (map.version < 2.0) {
        coordLat = ( datum.lat * FT_PER_DEG + location.y ) / R_EARTH_FT;
        var cosLat = Math.cos(coordLat);
        coordLong = ( ( datum.long * DEG_TO_RAD * R_EARTH_FT * cosLat ) + location.x ) / ( R_EARTH_FT * cosLat );

        coordLat = coordLat * RAD_TO_DEG;
        coordLong = coordLong * RAD_TO_DEG;
    }
    else {
        // Version 2 of Maps uses the center (data-map-version)
        // New Terrain Uses Map center in Theater.txt
        var x = location.x - 512 * KM_TO_FT;
        var y = location.y - 512 * KM_TO_FT;
        var result = offsetToLatLon(datum.lat, datum.long, x, y);
        coordLat = result.lat;    // Result lat in radians
        coordLong = result.lon;  // Result long in radians
    }

    return {lat: coordLat, long: coordLong};
}

//
// Basic Flight Computer stuff
//

// TOS is stored in hours on start day
function tosTime(hours) {
    hours = hours % 24;
    var hrs = hours >> 0;
    var min = ((hours - hrs) * 60) >> 0;
    var sec = ((((hours - hrs) * 60) - min) * 60) >> 0;

    hrs = (hrs < 10 ? "0" : "") + hrs;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;

    return hrs + ":" + min + ":" + sec;
}

// TOS get the days
function tosDay(hours) {
    var day = (hours / 24) >> 0;
    return day;
}

// Get TOS hours from day and time string
function tosHours(day,time) {
    var data = time.split(":");
    var hrs = (24 * parseInt(day)) + parseInt(data[0]) + (parseInt(data[1]) / 60) + (parseInt(data[2]) / 3600);
    return hrs;
}

/* Calculate ETA from Start time, distance and ground speed */
function getFlightHours(gs, dist) {
    return (dist / gs);
}
/* Flight speed */
function getGroundSpeed( duration, dist) {
    return (dist / duration);
}

function getFlightETA(startTime, gs, dist) {
    return startTime + flightTime(gs, dist);
}

function getSpeedForATA(startTime, endTime, dist) {
    return getFlightSpeed((endTime - startTime),dist);
}

// TAS to Mach number
function tas2mach(tas, oat) {
    // Compute Sonic Speed for OAT in Kelvin
    var temp = oat+273.15;
    var spd = tas / 1.944; // knots to m/s
    var a = Math.sqrt(1.4*287.053*temp);

    return (spd / a);
}
