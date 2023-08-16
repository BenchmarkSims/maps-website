//
// Javascript Charts for BMS Interactive Maps
//

var DataWindow;

var chart = {
    canvas: null,
    context: null
};

function updateAltitudeChart(id) {
      // Setup the main canvas for the view
    chart.canvas = DataWindow.document.getElementById(id);
    chart.context = chart.canvas.getContext("2d");

    chart.context.setLineDash([]);
    chart.context.strokeStyle = '#000000';
    chart.context.lineWidth = 1;
    chart.context.fillStyle = '#FFFFFF';

    chart.context.fillRect(50,10, 700,400);
    chart.context.beginPath();
    chart.context.rect(49,9, 702,402);
    chart.context.stroke();
}

function clearTable(table) {
    var rowCount = table.rows.length;

    // Clear and remove td rows rows
    for (var i=1;i < rowCount; i++) {
        table.deleteRow(1);
    }
}

function updateSteerpointsTable(id) {
    var table = document.getElementById(id);

    // Initialize Accumulators
    var total_dist = 0;
    var total_fuel = 200;

    // Clear and remove td rows rows
    clearTable(table);

    // Add Rows with Data
    for (var i=0;i < mission.route.length; i++) {
        var row = table.insertRow(-1);
        var stpt   = row.insertCell(0);
        var pos    = row.insertCell(1);
        var action = row.insertCell(2);
        var tos = row.insertCell(3);
        var hdg = row.insertCell(4);
        var dist = row.insertCell(5);
        var tas_cell = row.insertCell(6);
        var mach = row.insertCell(7);
        var alt_cell = row.insertCell(8);
        var fuel_cell = row.insertCell(9);

        fuel_cell.style.textAlign = "right";

        // Set Row Style
        row.className = ((i % 2) > 0)?"d0":"d1";

        if (mission.targets[i].action >= 0) {

            var position = map2LatLong(map.datum,{x: mission.targets[i].east,y: mission.targets[i].north});
            var lat = position.lat.toFixed(2);
            var long = position.long.toFixed(2);
            lat  += (position.lat < 0 ) ?"&degS":"&degN";
            long += (position.long < 0 )?"&degW":"&degE";

            // Fmap coordinates
            const scalar = 65.08475;
            var point = {x: mission.targets[i].x * properties.zoom,
                         y: mission.targets[i].y * properties.zoom };
            var fmap_x = (mission.targets[i].x / scalar) >> 0;
            var fmap_y = (mission.targets[i].y / scalar) >> 0;
            var alt = (-mission.targets[i].data);
            var oat = (fmap.version > 0)?getOutsideAirTemp(fmap_x,fmap_y):15;
            var tas = parseFloat(mission.route[i].spd);

            // Adjust surface temperature to altitude OAT
            oat -= (1.981 * (alt / 1000));
            var m = tas2mach(tas,oat);

            // Set Values
            stpt.innerHTML = (i+1).toString();
            pos.innerHTML = lat + " " + long;
            hdg.innerHTML = mission.route[i].crs;
            if (mission.targets[i].duration > 0) {
                tos.innerHTML = tosTime(mission.route[i].tos) + "+" + mission.targets[i].duration;
            }
            else {
                tos.innerHTML = tosTime(mission.route[i].tos);
            }
            action.innerHTML = ActionString[mission.targets[i].action];
            dist.innerHTML = total_dist.toFixed(1);
            tas_cell.innerHTML = tas;
            mach.innerHTML = m.toFixed(2);
            fuel_cell.innerHTML = mission.pkg.fuel - total_fuel.toFixed(0);
            alt_cell.innerHTML = (-mission.targets[i].data).toFixed(0).toString();

            if (mission.targets[i].action == Action.Land) {
                hdg.innerHTML = "N/A";
                break;
            }

            // Accumulate totals
            // Add Climb out fuel
            if (mission.targets[i].action == Action.Takeoff) total_fuel += 400;
            total_dist += mission.route[i].dist;
            total_fuel += mission.route[i].dist * 15 + mission.targets[i].duration * 100;
        }
    }
}

function updateTargetsTable(id) {
    var table = document.getElementById(id);

    // Clear and remove td rows rows
    clearTable(table);

    // Add Rows with Data
    for (var i = mission.targets.length - 1; i > 23; i--) {
        if (mission.targets[i].x > 0 || mission.targets[i].x > 0) {
            var row = table.insertRow(-1);
            var stpt = row.insertCell(0);
            var pos  = row.insertCell(1);
            var obj  = row.insertCell(2);

            // Set Row Style
            row.className = ((i % 2) > 0)?"d0":"d1";

            var position = map2LatLong(map.datum,{x: mission.targets[i].east,y: mission.targets[i].north});
            var lat = position.lat.toFixed(2);
            var long = position.long.toFixed(2);
            lat  += (position.lat < 0 ) ?"&degS":"&degN";
            long += (position.long < 0 )?"&degW":"&degE";

            // Set Values
            stpt.innerHTML = (i+57).toString();
            pos.innerHTML = lat + " " + long;
            obj.innerHTML = mission.targets[i].desc;
        }
    }
}

function updatePackageTable(id) {
    var table = document.getElementById(id);

    // Clear and remove td rows rows
    clearTable(table);

    // Add Rows with Data
    for (var i = 0; i < 5; i++) {

        var row = table.insertRow(-1);
        var name_cell = row.insertCell(0);
        var uhf_cell = row.insertCell(1);
        var vhf_cell = row.insertCell(2);
        var idm_cell = row.insertCell(3);
        var tcn_cell = row.insertCell(4);

        // Set Row Style
        row.className = ((i % 2) > 0)?"d0":"d1";
        var tcn = Math.abs(mission.pkg.chx[i]);
        var band = (mission.pkg.chx[i] > 0)?"Y":"X";

        // Set Values
        if (mission.radio.length > 0) {
            name_cell.innerHTML = mission.pkg.flights[i];
            uhf_cell.innerHTML  = mission.radio[14+i].freq;
            vhf_cell.innerHTML  = mission.radio[34 + i].freq + " [" + (15 + i) + "]";
        }
        else {
            name_cell.innerHTML = "Flight" + (i+1);
            uhf_cell.innerHTML  = "-";
            vhf_cell.innerHTML  = "-";
        }
        idm_cell.innerHTML  = "XMT " + (10 + i * 10);
        tcn_cell.innerHTML  = tcn + "/" + (tcn + 63) + band;
    }

}

function updateSupportTable(id) {
    var table = document.getElementById(id);

    // Clear and remove td rows rows
    clearTable(table);

    // If there is no Radio data then no Callsign lookup
    if (mission.radio.length == 0) return;

    var row = table.insertRow(-1);
    var stpt_cell = row.insertCell(0);
    var pos_cell  = row.insertCell(1);
    var name_cell = row.insertCell(2);
    var type_cell = row.insertCell(3);
    var uhf_cell  = row.insertCell(4);
    var vhf_cell  = row.insertCell(5);

    // Set Row Style
    row.className = "d1";

    // Set Values
    stpt_cell.innerHTML = "N/A";
    pos_cell.innerHTML = "N/A";
    name_cell.innerHTML = getCallsignByFreq(mission.radio[4].freq);
    type_cell.innerHTML = "AWACS";
    uhf_cell .innerHTML = mission.radio[4].freq  + " [6]";
    vhf_cell .innerHTML = mission.radio[24].freq;

    var t = getTankerIndex();
    if ( t > 0 ) {
        row = table.insertRow(-1);
        stpt_cell = row.insertCell(0);
        pos_cell  = row.insertCell(1);
        name_cell = row.insertCell(2);
        type_cell = row.insertCell(3);
        uhf_cell  = row.insertCell(4);
        vhf_cell  = row.insertCell(5);

        row.className = "d1";

        var position = map2LatLong(map.datum,{x: mission.targets[t].east,y: mission.targets[t].north});
        var lat = position.lat.toFixed(2);
        var long = position.long.toFixed(2);
        lat  += (position.lat < 0 ) ?"&degS":"&degN";
        long += (position.long < 0 )?"&degW":"&degE";

        stpt_cell.innerHTML = (t + 1);
        pos_cell.innerHTML = lat + " " + long;
        name_cell.innerHTML = getCallsignByFreq(mission.radio[12].freq);
        type_cell.innerHTML = "Tanker";
        uhf_cell .innerHTML = mission.radio[12].freq + " [13]";
        vhf_cell .innerHTML = mission.radio[32].freq;
    }
}

function parseAirportData(html,key) {
    var idx = html.innerHTML.indexOf(key);
    return (idx > -1)?html.innerHTML.substring(idx+key.length,idx+40).split('\n')[0]:"-";
}

function selectRunwayIndex(runways, wnd_dir) {
    var wind = wnd_dir/10;
    var runway = 0;
    var best = 36;
    for (var i=0; i < runways.length; i++){
        var rwy = parseInt(runways[i].substring(0,2));
        var diff = wind - rwy;
        if (diff < 0 ) diff +=36;
        if (diff < best) {
            best = diff;
            runway = i;
            break;
        }
    }
    return runway;
}

function parseAirportHTML(airport) {
    var afb = {
        gnd: "-",  twr: "-", app: "-", unic: "-",
        atis: "-", elev: "-", tcn: "-", rwy: []
    };

    // get Airport Data
    var elm = document.getElementById(airport);
    if (elm) {
        var pre = elm.getElementsByTagName('pre')[0];

        // Parse Attributes
        if (pre) {
            afb.tcn  = parseAirportData(pre,"TCN: ");
            afb.gnd  = parseAirportData(pre,"GND: ");
            afb.twr  = parseAirportData(pre,"TWR: ");
            afb.app  = parseAirportData(pre,"APP/DEP: ");
            afb.atis = parseAirportData(pre,"ATIS: ");
            afb.elev = parseAirportData(pre,"Elevation: ").split(' ')[0];
            afb.unic = parseAirportData(pre,"Unicom UHF: ");
            var rwy_str  = parseAirportData(pre,"RWY: ");
            afb.rwy = rwy_str.split(/[-/\ ]+/);
            //console.log(afb.rwy);
            if (afb.unic != "-") {
                afb.twr  = afb.unic;
            }
        }
    }
    return afb;
}

function addAirbaseRow(table, afb, type) {

    // Insert row with cells
    var row = table.insertRow(-1);
    row.className = "d1";
    var type_cell = row.insertCell(0);
    var pos_cell  = row.insertCell(1);
    var name_cell = row.insertCell(2);
    var tcn_cell  = row.insertCell(3);
    var gnd_cell  = row.insertCell(4);
    var twr_cell  = row.insertCell(5);
    var app_cell  = row.insertCell(6);
    var atis_cell = row.insertCell(7);

    // Get Table Values
    var name =  getAirportNearby({x: mission.targets[afb].x, y: mission.targets[afb].y }).name;
    var id = name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('\'', 'g'),''); // id format
    var data = parseAirportHTML(id);
    var position = map2LatLong(map.datum,{x: mission.targets[afb].east,y: mission.targets[afb].north});
    var lat = position.lat.toFixed(2);
    var long = position.long.toFixed(2);
    lat  += (position.lat < 0 ) ?"&degS":"&degN";
    long += (position.long < 0 )?"&degW":"&degE";

    // Set Table Values
    type_cell.innerHTML = type;
    pos_cell.innerHTML  = lat + " " + long;
    name_cell.innerHTML = name;
    tcn_cell.innerHTML = data.tcn;
    atis_cell.innerHTML = data.atis;
    gnd_cell .innerHTML = data.gnd;
    twr_cell .innerHTML = data.twr;
    app_cell .innerHTML = data.app;
}


function updateAirbasesTable(id) {
    var table = document.getElementById(id);
    var idx_home = getHomePlateIndex();
    var idx_alt = getAlternateIndex();

    // Clear and remove td rows rows
    clearTable(table);

    addAirbaseRow(table, 0, "DEP");
    if (idx_home >= 0) addAirbaseRow(table, idx_home, "ARR");
    if (idx_alt >= 0) addAirbaseRow(table, idx_alt, "ALT");
}

function translateThreats(t) {
    var threat = t.trim();
    if (threat == '19') threat = "SA-19";
    if (threat == '17') threat = "SA-17";
    if (threat == '16') threat = "SA-16";
    if (threat == '15') threat = "SA-15";
    if (threat == '14') threat = "SA-14";
    if (threat == '13') threat = "SA-13";
    if (threat == '11') threat = "SA-11";
    if (threat == '10') threat = "SA-10";
    if (threat == 'SA9') threat = "SA-9";
    if (threat == 'SA8') threat = "SA-8";
    if (threat == 'SA7') threat = "SA-7";
    if (threat == 'SA6') threat = "SA-6";
    if (threat == 'SA5') threat = "SA-5";
    if (threat == 'SA4') threat = "SA-4";
    if (threat == 'SA3') threat = "SA-3";
    if (threat == 'SA2') threat = "SA-2";

    return threat;
}

function updateBriefingTable(id) {
    var table = document.getElementById(id);

    // Set the Callsign
    var callsign = mission.pkg.callsign;
    if (mission.radio.length > 0) {
        table.rows[0].cells[0].innerHTML = "Callsign";
        table.rows[0].cells[1].innerHTML = mission.pkg.flights[callsign] + mission.pkg.seat;
    }
    else {
        table.rows[0].cells[1].innerHTML = mission.title.replace(new RegExp('_', 'g'), ' ');
        table.rows[0].cells[0].innerHTML = "Mission";
    }

    // Set the Ground Checkin Times
    var sec = 1 / 3600;
    var takeoff = mission.route[0].tos+sec;
    table.rows[1].cells[1].innerHTML = tosTime(takeoff - 1200 * sec) + ":PIT";
    table.rows[1].cells[2].innerHTML = tosTime(takeoff -  600 * sec) + ":UFC";
    table.rows[1].cells[3].innerHTML = tosTime(takeoff -  360 * sec) + ":TAXI";
    table.rows[1].cells[4].innerHTML = tosTime(takeoff) + ":T/O";

    // Set the Fuel
    table.rows[2].cells[1].innerHTML = mission.pkg.fuel;
    table.rows[2].cells[2].innerHTML = (mission.pkg.bingo+1000) + ":" + mission.pkg.bingo;

    // Set Laser Code
    var laser_code = (14 + mission.pkg.num) * 100 + (mission.pkg.callsign + 1)* 10 + mission.pkg.seat;
    table.rows[2].cells[4].innerHTML = laser_code;

    // Set Intel Data from PPTS
    var threats = [];
    for (var i=0;i<mission.ppts.length;i++) {
        if(threats.indexOf(mission.ppts[i].desc) === -1) {
            threats.push(mission.ppts[i].desc);
        }
    }

    var intel = "";
    for (var i=0;i<threats.length;i++) {
        intel += translateThreats(threats[i]) + " ";
    }
    table.rows[3].cells[1].innerHTML = intel;
}

function updateWxHeaderTable(id) {
    var table = document.getElementById(id);

    // Set the Callsign
    var callsign = mission.pkg.callsign;
    if (mission.radio.length > 0) {
        table.rows[0].cells[0].innerHTML = "Callsign";
        table.rows[0].cells[1].innerHTML = mission.pkg.flights[callsign] + mission.pkg.seat;
    }
    else {
        table.rows[0].cells[1].innerHTML = mission.title.replace(new RegExp('_', 'g'), ' ');
        table.rows[0].cells[0].innerHTML = "Mission";
    }
    table.rows[0].cells[3].innerHTML = padZeros(fmap.time,6) + "Z";
}

function addWxAirportRow(table, afb, type) {
    const scalar = 65.08475;

    // Insert row with cells
    var row = table.insertRow(-1);
    row.className = "d1";
    var type_cell = row.insertCell(0);
    var name_cell = row.insertCell(1);
    var rwy_cell  = row.insertCell(2);
    var elev_cell = row.insertCell(3);
    var oat_cell  = row.insertCell(4);
    var qnh_cell  = row.insertCell(5);
    var pa_cell   = row.insertCell(6);
    var da_cell   = row.insertCell(7);

    // Get Airport Info
    var airport =  getAirportNearby({x: mission.targets[afb].x, y: mission.targets[afb].y});
    var name = airport.name;
    var id = name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('\'', 'g'),''); // id format
    var data = parseAirportHTML(id);

    // Get Weather Info
    var fmap_x = (airport.x / scalar) >> 0;
    var fmap_y = (airport.y / scalar) >> 0;
    var oat = getOutsideAirTemp(fmap_x, fmap_y);
    var qnh = getPressure(fmap_x, fmap_y);

    // Calculate Standard Temp, Pressure Altitude and Density Altitude
    var elev = parseInt(data.elev);
    var st = 15 - (1.98*elev)/1000;
    var pa = elev + (1013 - qnh)*30;
    var da = pa + (120*(oat-st));
    var wnd = getWinds(fmap_x,fmap_y,0).direction;
    var rwy_idx = selectRunwayIndex(data.rwy,wnd);

    // Adjust for Imperial Units if needed
    if (!properties.settings.metric) oat = oat * 1.8 + 32;
    if (!properties.settings.metric) qnh = qnh / 33.863886666667;

    // Set Table Values
    type_cell.innerHTML = type;
    name_cell.innerHTML = name;
    rwy_cell.innerHTML  = data.rwy[rwy_idx].substring(0,2);
    elev_cell.innerHTML = elev + " ft";
    oat_cell.innerHTML  = (properties.settings.metric)?oat.toFixed(0) +"\xb0C":oat.toFixed(0)+"\xb0F";
    qnh_cell.innerHTML  = (properties.settings.metric)?qnh.toFixed(1) +" mb":qnh.toFixed(2) + " Hg";
    pa_cell.innerHTML   = pa.toFixed(0) + " ft";
    da_cell.innerHTML   = da.toFixed(0) + " ft";
}

function updateWxAirportsTable(id) {
    var table = document.getElementById(id);
    var idx_home = getHomePlateIndex();
    var idx_alt = getAlternateIndex();

    // Clear and remove td rows rows
    clearTable(table);

    addWxAirportRow(table, 0, "DEP");
    if (idx_home >= 0) addWxAirportRow(table, idx_home, "ARR");
    if (idx_alt >= 0) addWxAirportRow(table, idx_alt, "ALT");
}

function updateWxMetarTable(id) {
    var table = document.getElementById(id);
    var last_idx = getHomePlateIndex();
    var alt_idx = getAlternateIndex();
    var airports = [];

    // Clear and remove td rows rows
    clearTable(table);

    if (alt_idx >= 0 ) last_idx = alt_idx;

    for (var i=0;i < last_idx+1; i++) {

        // Get Airport Data nearest to the route
        var airport = getAirportNearby({x: mission.targets[i].x, y: mission.targets[i].y});
        var name = airport.name;
        var id = name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('\'', 'g'),''); // id format

        if(airports.indexOf(id) === -1) {
            airports.push(id);
        }
        else continue;

        // Insert row with cells
        var row = table.insertRow(-1);
        var num = airports.length;
        row.className = ((num % 2) > 0)?"d0":"d1";
        var num_cell = row.insertCell(0);
        var name_cell = row.insertCell(1);
        var metar_cell = row.insertCell(2);

        // Fmap coordinates
        const scalar = 65.08475;
        var fmap_x = (airport.x / scalar) >> 0;
        var fmap_y = (airport.y / scalar) >> 0;

        // Set Table Values
        num_cell.innerHTML = num;
        name_cell.innerHTML = name;
        metar_cell.innerHTML = getMETAR(fmap_x,fmap_y);
    }
}

function getWindsAlotStr(wind,alt,t) {
    var oat = (t - (1.981 * alt/1000));
    var neg = (oat < 0 )?true:false;
    var dir_str = (wind.direction/10).toFixed(0).toString();
    var spd_str = wind.speed.toFixed(0).toString();

    dir_str = (dir_str.length == 1)?"0"+dir_str:dir_str;
    spd_str = (spd_str.length == 1)?"0"+spd_str:spd_str;

    oat = Math.abs(oat);
    var oat_str = oat.toFixed(0).toString();
    oat_str = (oat_str.length == 1)?"0"+oat_str:oat_str;
    if (alt < 30000) {
        oat_str = (neg)?"-" + oat_str:"+" + oat_str;
    }

    return dir_str + spd_str + oat_str;
}

function updateWxWindsTable(id) {
    var table = document.getElementById(id);
    var last_idx = getHomePlateIndex();
    var alt_idx = getAlternateIndex();
    var airports = [];

    if (alt_idx >= 0 ) last_idx = alt_idx;

    // Clear and remove td rows rows
    clearTable(table);

    for (var i=0;i < last_idx+1; i++) {

        // Get Airport Data nearest to the route
        var airport = getAirportNearby({x: mission.targets[i].x, y: mission.targets[i].y});
        var name = airport.name;
        var id = name.replace(new RegExp(' ', 'g'), '_').replace(new RegExp('\'', 'g'),''); // id format

        if(airports.indexOf(id) === -1) {
            airports.push(id);
        }
        else continue;

        // Insert row with cells
        var row = table.insertRow(-1);
        var num = airports.length;
        row.className = ((num % 2) > 0)?"d0":"d1";
        var num_cell    = row.insertCell(0);
        var name_cell   = row.insertCell(1);
        var _3000_cell  = row.insertCell(2);
        var _6000_cell  = row.insertCell(3);
        var _9000_cell  = row.insertCell(4);
        var _12000_cell = row.insertCell(5);
        var _18000_cell = row.insertCell(6);
        var _24000_cell = row.insertCell(7);
        var _30000_cell = row.insertCell(8);

        // Fmap coordinates
        const scalar = 65.08475;
        var fmap_x = (airport.x / scalar) >> 0;
        var fmap_y = (airport.y / scalar) >> 0;
        var wind = getWinds(fmap_x,fmap_y,2);
        var t = getOutsideAirTemp(fmap_x,fmap_y);

        // Set Table Values
        num_cell.innerHTML = num;
        name_cell.innerHTML = name;
        _3000_cell.innerHTML  = getWindsAlotStr(getWinds(fmap_x,fmap_y,1), 3000,t);
        _6000_cell.innerHTML  = getWindsAlotStr(getWinds(fmap_x,fmap_y,2), 6000,t);
        _9000_cell.innerHTML  = getWindsAlotStr(getWinds(fmap_x,fmap_y,3), 9000,t);
        _12000_cell.innerHTML = getWindsAlotStr(getWinds(fmap_x,fmap_y,4),12000,t);
        _18000_cell.innerHTML = getWindsAlotStr(getWinds(fmap_x,fmap_y,5),18000,t);
        _24000_cell.innerHTML = getWindsAlotStr(getWinds(fmap_x,fmap_y,6),24000,t);
        _30000_cell.innerHTML = getWindsAlotStr(getWinds(fmap_x,fmap_y,7),30000,t);
    }
}

function openChart(id) {
    DataWindow = window.open('',id,'width=666,height=888,resizable=0');
    var content = document.getElementById(id);

    // Update the table Data
    if (id == "tableDatacard") {
        updateBriefingTable("tbl-brf");
        updatePackageTable("tbl-pkg");
        updateAirbasesTable("tbl-afb");
        updateSteerpointsTable("tbl-stpts");
        updateTargetsTable("tbl-objs");
        updateSupportTable("tbl-sppt");
        DataWindow.document.writeln('<html><head><title>Mission Datacard</title><link rel="stylesheet" href="../common/scripts/map_chart.css"></head><body style="background-color: #F5F5F5;">');
    }

    if (id == "tableWeather") {
        updateWxHeaderTable("tbl-wxhdr");
        updateWxAirportsTable("tbl-wxafb");
        updateWxMetarTable("tbl-metar");
        updateWxWindsTable("tbl-winds");
        DataWindow.document.writeln('<html><head><title>Weather Report</title><link rel="stylesheet" href="../common/scripts/map_chart.css"></head><body style="background-color: #F5F5F5;">');
    }

    // Write the HTML for the Report
    DataWindow.document.writeln( content.outerHTML );
    DataWindow.document.writeln('</body></html>');
    DataWindow.document.close();

    // Draw Data on Canvas if Any
    if (id == "chartAltitudes") {
        updateAltitudeChart("chart");
    }
}

function showChart(id) {
    // Open the chart
    openChart(id);
}

