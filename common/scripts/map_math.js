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

/* Covert to Lat and Long from ft offset coordinates
 *
 * in datum:    degrees Latitude and Longitude of left bottom map corner
 * in location: point with x and y in feet.
 * returns: Point with Latitude and Longitude
 */
function map2LatLong(datum,location) {
    //const FT_PER_DEG = 365220.59;
    const FT_PER_DEG = 365221.8846;
    const RAD_TO_DEG = 57.2957795;
    const DEG_TO_RAD = 0.01745329;
    const R_EARTH_FT = 20925700;

    var coordLat = ( datum.lat * FT_PER_DEG + location.y ) / R_EARTH_FT;
    var cosLat = Math.cos(coordLat);
    var coordLong = ( ( datum.long * DEG_TO_RAD * R_EARTH_FT * cosLat ) + location.x ) / ( R_EARTH_FT * cosLat );
    coordLat = coordLat * RAD_TO_DEG;
    coordLong = coordLong * RAD_TO_DEG;

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
