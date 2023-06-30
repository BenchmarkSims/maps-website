// BMS Mission Related Routines

const Action = {
    Target: -1,
    Nav: 0,
    Takeoff: 1,
    Push: 2,
    Split: 3,
    Refuel: 4,
    Rearm: 5,
    Pickup: 6,
    Land: 7,
    Holding_Pt: 8,
    Contact: 9,
    Escort: 10,
    Sweep: 11,
    CAP: 12,
    Intercept: 13,
    Grnd_Attack: 14,
    Surf_Attack: 15,
    S_D: 16,
    Strike: 17,
    Bomb: 18,
    SEAD: 19,
    ELINT: 20,
    Recon: 21,
    Rescue: 22,
    ASW: 23,
    Fuel: 24,
    Air_Drop: 25,
    Jamming: 26,
};

const ActionString = [
    "Nav","Takeoff","Push","Split","Refuel","Rearm","Pickup","Land","Holding_Pt",
    "Contact","Escort","Sweep","CAP","Intercept","Grnd_Attack","Surf_Attack","S_D","Strike",
    "Bomb","SEAD","ELINT","Recon","Rescue","ASW","Fuel","Air_Drop","Jamming",
];

// Mission Data
var mission = {
    changed: false,
    title: "",
    centroid: {x: 0, y: 0, n: 0},
    ppts: [],
    lines: [],
    targets: [],
    route: [],
    radio: [],
    pkg: {
        num: 1,
        flights: [],
        chx: [15,16,17,18,19],      // Y-band positive and X-band negative
        callsign: 0,
        seat: 1,
        fuel: 7000,
        bingo: 1000
    }
};

// List of Mission Text Abbreviations
// This is used to keep the Objectives list remain within max 2 lines per
// objective
function abbreviate(text){
    // Add as many abbreviations as needed
    // This will keep the text within a line if possible
    text = text.replace("Air Defense", "AD");
    text = text.replace("Airbase", "AB");
    text = text.replace("Depot", "Dep");
    text = text.replace("Runway", "Rwy");
    text = text.replace("Complex", "Cmplx");
    text = text.replace("Tower", "Twr");
    text = text.replace("Control", "Ctrl");
    text = text.replace("Center", "Ctr");
    text = text.replace("Factory", "Fac");
    text = text.replace("Section", "Sec");
    text = text.replace("Warehouse", "Wrhs");
    text = text.replace("Maintenance", "Maint.");
    text = text.replace("Hangar", "Hngr");
    text = text.replace("Battalion", "BN");
    text = text.replace("Brigade", "BDE");
    text = text.replace("Defense", "Def.");
    text = text.replace("Manufacturer", "Mfr.");
    text = text.replace("Bridge Bridge", "Bridge");
    text = text.replace("Village", "Vill.");
    text = text.replace("Transport", "Tpt.");
    text = text.replace("Station", "Sta.");
    return text;
  }

// MISSION DATA PROCESSING
function clearMissionData() {
    mission.ppts = [];
    mission.lines = [];
    mission.targets = [];
    mission.route = [];
    mission.radio = [];
    mission.pkg = { num: 1, flights: [], chx: [15,16,17,18,19], callsign: 0, seat: 1, fuel: 7000, bingo: 1000};
    mission.title = "No Title";
    mission.centroid = {x: 0, y: 0, n: 0};

    // Reload the saved channel settings
    loadSettings();
}

// Check if the waypoint index is of target type
function isTargetWaypoint(index) {
    var target = false;
    var stpt = mission.targets[index];
    switch (stpt.action) {
        case Action.Target:
            case Action.CAP:
            case Action.Grnd_Attack:
            case Action.Surf_Attack:
            case Action.Strike:
            case Action.Bomb:
            case Action.SEAD:
            case Action.S_D:
            case Action.Recon:
            case Action.Sweep:
                target = true;
                break;
            default:
                target = false;
    }
    return target;
}

function getSteerpointType(index) {
    if (isTargetWaypoint(index)) {
        return "TGT";
    }
    return "STPT";
}

// Parse and create ppt object
function addPrePlannedThreat(line) {
    var data = line.substring(line.indexOf("=")+1).split(",");
    var ppt = {x: 0, y: 0, z:0, radius: 0, desc: "threat"};
    ppt.x = parseFloat(data[1]) / map.resolution;
    ppt.y = map.offset - parseFloat(data[0]) / map.resolution;
    ppt.z = parseFloat(data[2]);
    ppt.radius = parseFloat(data[3]) / map.resolution;
    ppt.desc = data[4];
    mission.ppts.push(ppt);
  }

// Parse and create line object
function addLineSteerPoint(line) {
    var data = line.substring(line.indexOf("=")+1).split(",");
    var line = {x: 0, y: 0};
    line.x = parseFloat(data[1]) / map.resolution;
    line.y = map.offset - parseFloat(data[0]) / map.resolution;
    mission.lines.push(line);
}

// Load Default Duration for Actions
// Could be an array of durations for the Actions but that is harder to maintain
function getTargetDuration(action) {
    var duration = 0;
    switch (action) {
        case Action.CAP:
            duration = 15;
            break;
        case Action.Holding_Pt:
            duration = 4;
            break;
        case Action.Refuel:
            duration = 20;
            break;
        default:
            duration = 0;
            break;
    }
    return duration;
}

// Calculate and return the Centroid of the Mission
function getCentroid() {
    var centroid = {x: mission.centroid.x /mission.centroid.n, y: mission.centroid.y /mission.centroid.n}
    return (centroid);
}

// Parse and create Target object
function addTarget(line) {
    var data = line.substring(line.indexOf("=")+1).split(",");
    var target = {x: 0, y: 0, data: 0, action: 0, duration: 0, desc: " Not set" };
    target.east = parseFloat(data[1]);
    target.north = parseFloat(data[0]);
    target.x = parseFloat(data[1]) / map.resolution;
    target.y = map.offset - parseFloat(data[0]) / map.resolution;
    target.data = parseFloat(data[2]);
    target.action = parseInt(data[3]);
    if (data[4]) target.desc = data[4];
    target.duration = getTargetDuration(target.action);
    mission.targets.push(target);

    // Check for addition to Centroid
    if (target.x != 0 && target.y != 0) {
        mission.centroid.x += target.x;
        mission.centroid.y += target.y;
        mission.centroid.n += 1;
    }
}

// Parse and create Radio object
function addRadio(line, band) {
    var data = line.split("=");
    var freq = (parseFloat(data[1]) / 1000).toFixed(3);
    var entry = {id: data[0], freq: freq};
    mission.radio.push(entry);
}

// Add title if found in file (Mission.ini)
function addTitle(line) {
    mission.title = line.substring(line.indexOf("=")+1);
}

// Recompute the TOS for the route
function updateRoute(tos) {
    for (var i = 0; i < mission.route.length; i++) {
        var waypoint =  mission.route[i];
        waypoint.tos = tos;
        var time = getFlightHours(waypoint.spd, waypoint.dist);
        var extra = mission.targets[i].duration / 60;
        tos += time + extra;
    }
}

function getMissionTime() {
    var time_takeoff = 0;
    var time_land = 0;
    for (var i = 0; i < mission.route.length; i++) {
        if (mission.targets[i].action == Action.Takeoff) {
            time_takeoff = mission.route[i].tos;
        }
        if (mission.targets[i].action == Action.Land) {
            time_land = mission.route[i].tos;
            break;
        }
    }
    return(time_land - time_takeoff);
}

function getTankerIndex() {
    for (var i = 0; i < mission.targets.length; i++) {
        if (mission.targets[i].action == Action.Refuel) {
            return i;
        }
    }
    return -1;
}

function getHomePlateIndex() {
    for (var i = 0; i < mission.targets.length; i++) {
        if (mission.targets[i].action == Action.Land) {
            return i;
        }
    }
    return -1;
}

function getAlternateIndex() {
    var index = getHomePlateIndex();
    for (var i = (index + 1); i < mission.targets.length; i++) {
        if (mission.targets[i].action == Action.Land) {
            index = i;
            break;
        }
    }
    return index;
}

function getEstimatedFuelUntil(index) {
    var total_fuel = 600; // 200 taxi and 400 climb
    for (var i = 0; i < index; i++) {
        total_fuel += mission.route[i].dist * 15 + mission.targets[i].duration * 100;
    }
    return total_fuel;
}

// How far away do we get from Homeplate based on route
function getMaxHomePlateDistance() {
    var wpt_far = 0;
    var dist_max = 0;
    var dist_home = 0;
    var wpt_land = getHomePlateIndex();
    if (wpt_land == -1) return 0;
    var point_land = {x:mission.targets[wpt_land].x, y:mission.targets[wpt_land].y};

    // Determine Maximum distance from Home Plate
    for (var i = 0; i < wpt_land; i++) {
        var point_wpt = {x:mission.targets[i].x, y:mission.targets[i].y};
        if (point_wpt.x > 0 && point_wpt.y > 0 ){
            var vect = vector(point_wpt,point_land);
            if (vect.magnitude > dist_max) {
                dist_max = vect.magnitude;
                wpt_far = i;
            }
        }
        else {
            continue;
        }
    }

    // Compute distance to Homeplate from furthest to land along flight plan
    for (var i = wpt_far; i < wpt_land; i++) {
        var point_wpt = {x:mission.targets[i].x, y:mission.targets[i].y};
        var point_nxt = {x:mission.targets[i + 1].x, y:mission.targets[i + 1].y};
        var vect = vector(point_wpt,point_nxt);
        dist_home += vect.magnitude;
    }

    return(dist_home / PX2NM);
}

function getMissionDistance() {
    var distance = 0;
    for (var i = 0; i < mission.route.length; i++) {
        if (mission.targets[i].action == Action.Land) {
            break;
        }
        distance += mission.route[i].dist;
    }
    return(distance);
}

// Setup the waypoint given an initial TOS and fixed speed
function initializeRoute(tos, speed) {

    for (var i = 1; i < mission.targets.length; i++) {

        var start_point = {x: mission.targets[i-1].x, y: mission.targets[i-1].y};
        var end_point = {x: mission.targets[i].x, y: mission.targets[i].y};
        var leg = vector(start_point,end_point);
        var time = getFlightHours(speed, leg.magnitude / PX2NM);
        var extra = mission.targets[i-1].duration / 60;

        var waypoint = {tos: tos, dist: leg.magnitude / PX2NM, crs: rad2deg(leg.direction), spd: speed};
        mission.route.push(waypoint);

        // Determine TOS for the next Waypoint
        tos += time + extra;
    }
}

// Setup the initial package information from the Callsign.ini
function initializePackage() {
    // Check if this is Callsign.ini
    // There will be no UHF/VHF
    if (mission.radio.length != 40) return;

    for (var i = 0; i < 5; i++) {
        // Set Values
        var callsign = getCallsignByFreq(mission.radio[34 + i].freq);
        mission.pkg.flights.push(callsign);
    }
}

// Process the Data Cartridge Mission.ini or Pilot.ini file
function processDataCartridge(text){
    var line = text.split("\n");
    var centroid = {x:0, y:0};

    // Clear Current mission data Lists
    clearMissionData();

    for (var i = 0; i < line.length; i++) {
        if (line[i].startsWith('title')) addTitle(line[i])
        if (line[i].startsWith('ppt_')) addPrePlannedThreat(line[i]);
        if (line[i].startsWith('lineSTPT_')) addLineSteerPoint(line[i]);
        if (line[i].startsWith('target_')) addTarget(line[i]);
        if (line[i].startsWith('UHF_') && !line[i].startsWith('UHF_COMMENT')) addRadio(line[i]);
        if (line[i].startsWith('VHF_') && !line[i].startsWith('VHF_COMMENT')) addRadio(line[i]);
    }

    // Now Determine Route Information
    initializeRoute(9,350);
    initializePackage();

    mission.changed = true;
}
