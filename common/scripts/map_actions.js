//
// Javascript for BMS Interactive Maps
//

// dependencies:
//   map_math.js
//   map_files.js
//    map_mission.js
//    map_weather.js
//   map_draw.js

// Global Enums
const Mode = {
  None: Symbol("none"),
  Move: Symbol("move"),
  Bullseye: Symbol("bullseye"),
  Compass: Symbol("compass"),
	Measure: Symbol("measure"),
	Draw: Symbol("draw"),
  Erase: Symbol("erase"),
  Write: Symbol("write"),
  Symbol: Symbol("symbol")
}

// Render Layers
var layer = {
  mission:  {canvas: document.createElement("canvas"), ctx: null, used: false},
  whitebrd: {canvas: document.createElement("canvas"), ctx: null, used: false},
  weather:  {canvas: document.createElement("canvas"), ctx: null, used: false}
}

// Global Variables
var modal;
var textEntry;
var canvas;
var context;
var origin = 0;
var theater = "";
var map = {
  feet: 3358679,
  pixels: 0,
  offset: 0,
  resolution: 0,
  datum: {
    lat: 0,
    long: 0}
};

var bullseye = {x: 1920, y: 1920, show: false, coords: 0};
var chart_changed = false;
var properties = {
  zoom: 1,
  mode: Mode.Move, // Set to Move by default
  shifted: false,
  ctrl: false,
  pointer: false,
  pencil: {
    id: 0,
    color: '#0032ff',
  },
  eraser: {
    dimension: 16,
  },
  entity: {
    sidc: "10061000161211000000",
    img: null,
  },
  text: {
    typing: false,
    x: 0,
    y: 0
  },
  legend: 0,
  settings: {
    metric: true,
    altitude: 0,
    weather: 2,
    filter: 0,
    visibility: {
      bullseye: true,
      mission: true,
      weather: true,
      whitebrd: true,
      coordinates: false
    }
  },
  connection: {
    callsign: "",
    session: "",
    host: "localhost",
    port: "3000",
    secure: false,
  },
  waypoint: {
    stpt: 0,
    landed: false
  }
};

const limits = {
  zoom_max: 2.5,
  zoom_min: 0.5,
  wheel_rate_hz: 20
}

// Toolbar Icons for actions
const toolbar = {
  icon: {
    move: [
      "../common/assets/icon_move1.png",
      "../common/assets/icon_move.png"
    ],
    bullseye: [
      "../common/assets/icon_bullseye1.png",
      "../common/assets/icon_bullseye.png"
    ],
    ruler: [
      "../common/assets/icon_ruler1.png",
      "../common/assets/icon_ruler.png"
    ],
    text: [
      "../common/assets/icon_text1.png",
      "../common/assets/icon_text.png"
    ],
    eraser: [
      "../common/assets/icon_eraser1.png",
      "../common/assets/icon_eraser.png"
    ],
    symbol: [
      "../common/assets/icon_sword1.png",
      "../common/assets/icon_sword.png"
    ],
    pencil: [
      "../common/assets/icon_pencil1.png",
      "../common/assets/icon_pencil2.png",
      "../common/assets/icon_pencil3.png",
      "../common/assets/icon_pencil4.png",
      "../common/assets/icon_pencil.png",
    ]
  }
};

// Display the Object info in the popup modal
function popup(menu) {
  window.modal = document.getElementById(menu);
  window.modal.style.display = "block";
}

function typeText() {
  // Setup Text Entry
  var font_size = 32 * properties.zoom;
  window.textEntry = document.getElementById("TextEntry");
  window.textEntry.style.top = window.origin.y + 'px';
  window.textEntry.style.left = window.origin.x + 'px';
  window.textEntry.style.display = "block";
  window.textEntry.style.font = font_size.toString() + 'px sans-serif'
  window.textEntry.focus();
  properties.text.typing = true;
  properties.text.x = window.origin.x;
  properties.text.y = window.origin.y;
}

// Commit the text to the Whiteboard
function writeText() {
  var scale = 1 / properties.zoom;
  window.textEntry = document.getElementById("TextEntry");
  var text = window.textEntry.value;
  textEntry.blur();
  properties.text.typing = false;
  drawText(layer.whitebrd.ctx,text, properties.text.x * scale ,properties.text.y * scale);
  imcsMsgTextSend(text,properties.text.x * scale ,properties.text.y * scale);
  layer.whitebrd.used = true;
  refreshCanvas();

  // Clear and hide Text Area
  window.textEntry.value = "";
  window.textEntry.style.display = "none";
}

// Open a new window for the chart (587x900) 1:1.534
function chart(url) {
  window.open(url,'popup','width=610,height=835');
  return false;
}

// Hide the popup modal
function handle_click(e) {
  if (e.target == window.modal) {
    window.modal.style.display = "none";
    window.modal = undefined;
  }
}

// For Desktop click
window.onclick = function(e) {
  handle_click(e);
}

// For Tablet "click/touch"
window.ontouchstart = function(e) {
  var target = e.target.id

  if (target == "tas-val" || target == "alt-val") {
    return;
  }
  else {
    e.preventDefault();
    handle_click(e);
  }
}

// Find the airport and draw highlight
function locateAirport(list) {
  // Get the selected airport and map area coordinates
  var imageMap = document.getElementById("imgMap");
  var area = imageMap.children[list.options[list.selectedIndex].value];
  var coords = area.coords.split(",");
  const radius = 17;

  // Clear last location and Render the new locator
  refreshCanvas();
  x = parseInt(coords[0]);
  y = parseInt(coords[1]);
  drawHighlight(context,x,y,radius * properties.zoom);

  // Make the airport the focus
  window.scrollTo(x-window.innerWidth/2,y-window.innerHeight/2);
}

// Get the nearest airport name based on a map point
function getAirportNearby(point1) {
  // Get the selected airport and map area coordinates
  var imageMap = document.getElementById("imgMap");
  var areas  = imageMap.children;
  var nearby = {distance: 4096, name: "", x: 0, y: 0  };
  var close;

  for (area of areas) {
    var coords = area.coords.split(",");
    var point2 = {x: coords[0] / properties.zoom, y: coords[1] / properties.zoom};
    var dist = distance(point1, point2);
    if (dist <= nearby.distance && area.alt != "Legend" && area.alt != "Bullseye") {
      nearby.distance = dist;
      nearby.name = area.title.split(" METAR")[0];
      nearby.x = point2.x;
      nearby.y = point2.y;
    }
  }
  return nearby;
}

function selectUnit(list) {
  // Select pressure and temperature unit
  if (list.name == "imperial") {
    if (list.checked == true) properties.settings.metric = false;
    else properties.settings.metric = true;
  }
  if (properties.settings.weather == 2 || properties.settings.weather == 3) {
    chart_changed = true;
  }
  updateAirportTitles();
  saveSettings();
  refreshCanvas();
}

// Capture and Save the IMCS connection information
function changedIMCS(list) {
  // check changed property and set value
  properties.connection.callsign = document.getElementById("imcs-callsign").value;
  properties.connection.session = document.getElementById("imcs-session").value;
  properties.connection.host = document.getElementById("imcs-host").value;
  properties.connection.port = document.getElementById("imcs-port").value;
  properties.connection.secure = document.getElementById("imcs-secure").checked;
  saveSettings();
}

function selectAltitude(list) {
   properties.settings.altitude = list.options[list.selectedIndex].value;
   chart_changed = true;
   saveSettings();
   refreshCanvas();
}

function selectStyle(list) {
  var id = list.id;

  // Update draw Style settings
  switch (id) {
    case "line-color":
      style.line.color = list.value;
      break;

      case "line-width":
        style.line.width = list.value;
        break;

      case "line-style":
        if (list.value == 0) style.line.style = [];
        if (list.value == 1) style.line.style = [15,5];
        if (list.value == 2) style.line.style = [3,3];
        break;

      case "fill-style":
        style.fill.mode = list.value;
        break;

      case "fill-color":
         style.fill.color = list.value;
        break;

      case "opacity-range":
      case "opacity-num":
        style.fill.opacity = parseFloat(list.value) / 100;
        document.getElementById("opacity-num").value = list.value;
        document.getElementById("opacity-range").value = list.value;
        break;

      case "erase-rng":
      case "erase-num":
        properties.eraser.dimension = list.value;
        document.getElementById("erase-num").value = list.value;
        document.getElementById("erase-rng").value = list.value;
        break;

    default:
      break;
  }

  //console.log(style);
}

function selectSymbols(list) {
  var id = list.id;
  var sidc = ""

  // Update draw Style settings
  switch (id) {
    case "sidc-identity":
    case "sidc-set":
      sidc += document.getElementById("sidc-identity").value;
      sidc += document.getElementById("sidc-set").value;
      setupSymbolsList(sidc);
      break;

    case "sidc-entity":
    case "sidc-sec1":
    case "sidc-sec2":
    default:
      break;
  }

  // Update the Symbol and SIDC
  sidc = document.getElementById("sidc-entity").value;
  var entity = firstSymbol(sidc);
  if (entity) {
    properties.entity.sidc = entity.sidc;
    properties.entity.img = new Image();
    properties.entity.img.setAttribute('crossorigin', 'anonymous');
    properties.entity.img.src = entity.icon;
    document.getElementById("sidc-val").innerHTML = entity.sidc;
    document.getElementById("sidc-symbol").src=entity.icon;
  }
}

// Update the selected Weather Chart Type
function selectChart(list) {
  properties.settings.weather = parseInt(list.options[list.selectedIndex].value);
  chart_changed = true;
  saveSettings();
  refreshCanvas();
}

// Update the selected Weather Chart Type
function selectFilter(list) {
  var bg_img = document.getElementById('map');
  properties.settings.filter = parseInt(list.options[list.selectedIndex].value);

  if (properties.settings.filter == 0) {
    bg_img.setAttribute('class', 'background');
  }
  if (properties.settings.filter == 1) {
    bg_img.setAttribute('class', 'background_mono');
  }
  if (properties.settings.filter == 2) {
    bg_img.setAttribute('class', 'background_sepia');
  }
  if (properties.settings.filter == 3) {
    bg_img.setAttribute('class', 'background_dark');
  }

  //chart_changed = true;
  saveSettings();
  refreshCanvas();
}

function updatedTOS() {
  var hrs = document.getElementById("tos-hrs").value;
  var min = document.getElementById("tos-min").value;
  var sec = document.getElementById("tos-sec").value;
  var time = hrs + ":" + min + ":" + sec;
  var day = document.getElementById("day-val").value;
  var tos = tosHours(day,time);
  var duration = 0;
  var distance = 0;
  var speed = 0;
  var extra = 0;

  // Update speeds to and from this waypoint
  if (mission.targets[properties.waypoint.stpt].action != Action.Takeoff) {
    // Update Speed of previous waypoint
    duration = tos - mission.route[properties.waypoint.stpt - 1 ].tos;
    distance = mission.route[properties.waypoint.stpt - 1].dist;
    speed = getGroundSpeed(duration, distance);
    mission.route[properties.waypoint.stpt-1].spd = speed;

    // Update speed of current waypoint
    duration = mission.route[properties.waypoint.stpt + 1 ].tos - tos;
    distance = mission.route[properties.waypoint.stpt].dist;
    extra = (mission.targets[properties.waypoint.stpt - 1 ].duration) / 60;
    speed = getGroundSpeed(duration, distance);
    mission.route[properties.waypoint.stpt].spd = speed;
    mission.route[properties.waypoint.stpt].tos = tos;
  }
  else {
    updateRoute(tos);
  }
  updateMissionInfo();
  updateRouteInfo();
}

function updatedSpeed() {
  var speed = parseFloat(document.getElementById("tas-val").value);
  mission.route[properties.waypoint.stpt].spd = speed;

  updateRoute(mission.route[0].tos);
  updateMissionInfo();
  updateRouteInfo();
}

function updatedAltitude() {
  var altitude = parseFloat(document.getElementById("alt-val").value);
  mission.targets[properties.waypoint.stpt].data = -altitude;
}

function selectAction(list) {
  var action = parseFloat(document.getElementById("action-select").value);
  if (mission.targets[properties.waypoint.stpt].action != 1 &&
      mission.targets[properties.waypoint.stpt].action != 7) {
      mission.targets[properties.waypoint.stpt].action = action;
  }
  else {
    updateRouteInfo();
  }
}

function selectFormation(list) {
  //console.log("selectFormation");
  // Not in .INI
}

function selectEnroute(list) {
  //console.log("selectEnroute");
  // Not in .INI
}

function selectDuration(list) {
  //console.log("selectDuration");
  var duration = parseFloat(document.getElementById("dur-val").value);
  mission.targets[properties.waypoint.stpt].duration = duration;

  updateRoute(mission.route[0].tos);
  updateMissionInfo();
  updateRouteInfo();
}

function selectPackage(obj) {
  var id = obj.id;
  switch(id) {
    case "pkg-seat":
      mission.pkg.seat = parseInt(obj.options[obj.selectedIndex].value);
      break;
    case "pkg-flight":
      mission.pkg.callsign = parseInt(obj.value) - 1;
      document.getElementById("flt-num").innerHTML = (mission.pkg.callsign + 1).toString();
      document.getElementById("pkg-chx").selectedIndex = Math.abs(mission.pkg.chx[mission.pkg.callsign]) - 11;
      document.getElementById("pkg-band").selectedIndex = (mission.pkg.chx[mission.pkg.callsign] > 0)?0:1;
      break;
    case "pkg-num":
      mission.pkg.num = parseInt(obj.value);
      break;
    case "pkg-fuel":
      mission.pkg.fuel = parseInt(obj.value);
      updateMissionInfo();
      break;
    case "pkg-chx":
      var chx = parseInt(obj.options[obj.selectedIndex].value);
      var band = (mission.pkg.chx[mission.pkg.callsign] > 0)?1:-1;
      mission.pkg.chx[mission.pkg.callsign] = chx * band;
      saveSettings();
      break;
    case "pkg-band":
      var band = parseInt(obj.options[obj.selectedIndex].value);
      var chx = Math.abs(mission.pkg.chx[mission.pkg.callsign]);
      mission.pkg.chx[mission.pkg.callsign] = chx * band;
      saveSettings();
      break;

    default:
      break;
  }
}

function selectVisibility(list) {

  // Check Settings of Visibility
  if (list.name == "hide_be") {
    if (list.checked == true) properties.settings.visibility.bullseye = false;
    else properties.settings.visibility.bullseye = true;
  }
  if (list.name == "hide_ms") {
    if (list.checked == true) properties.settings.visibility.mission = false;
    else properties.settings.visibility.mission = true;
  }
  if (list.name == "hide_wx") {
    if (list.checked == true) properties.settings.visibility.weather = false;
    else properties.settings.visibility.weather = true;
  }
  if (list.name == "hide_wb") {
    if (list.checked == true) properties.settings.visibility.whitebrd = false;
    else properties.settings.visibility.whitebrd = true;
  }
  if (list.name == "hide_xy") {
    if (list.checked == true) properties.settings.visibility.coordinates = false;
    else properties.settings.visibility.coordinates = true;
  }

  saveSettings();
  refreshCanvas();
}

var hotspots;
function storeMapCoordinates() {
  var imgMap = document.getElementById("imgMap");
  hotspots = [];
  for (area of imgMap.children) hotspots.push(area);
}

// Scale the image map coordinates to match the airport overlay image
function scaleMap(scale) {
  var imageMap = document.getElementById("imgMap");
  var areas  = imageMap.children;
  i = 0;
  for (area of areas) {
      var coordArr = hotspots[i++].coords.split(',');
      area.coords = coordArr.map(coord => Math.round(coord * scale)).join(',');
      if (area.alt == "Legend") properties.legend = area.coords;
      if (area.alt == "Bullseye") bullseye.coords = area.coords;
  }
}

// Check it we are touching a toolbar
function isToolbarButton(e) {
  return (["move", "zoom1", "zoom2", "bullseye", "compass", "ruler", "symbol", "pencil", "text", "eraser",
           "settings", "clear", "reset", "steerpoints", "altitudes"].includes(e.target.id));
}

// Adjust the toolbar based on modes and properties
function updateToolbar() {
  if (properties.mode == Mode.Draw) document.getElementById("pencil").src=toolbar.icon.pencil[properties.pencil.id];
  else document.getElementById("pencil").src=toolbar.icon.pencil[4];

  if (properties.mode == Mode.Move) document.getElementById("move").src=toolbar.icon.move[0];
  else document.getElementById("move").src=toolbar.icon.move[1];

  if (properties.mode == Mode.Bullseye) document.getElementById("bullseye").src=toolbar.icon.bullseye[0];
  else document.getElementById("bullseye").src=toolbar.icon.bullseye[1];

  if (properties.mode == Mode.Measure) document.getElementById("ruler").src=toolbar.icon.ruler[0];
  else document.getElementById("ruler").src=toolbar.icon.ruler[1];

  if (properties.mode == Mode.Erase) document.getElementById("eraser").src=toolbar.icon.eraser[0];
  else document.getElementById("eraser").src=toolbar.icon.eraser[1];

  if (properties.mode == Mode.Write) document.getElementById("text").src=toolbar.icon.text[0];
  else document.getElementById("text").src=toolbar.icon.text[1];

  if (properties.mode == Mode.Symbol) document.getElementById("symbol").src=toolbar.icon.symbol[0];
  else document.getElementById("symbol").src=toolbar.icon.symbol[1];
}

function degreesString(degrees) {
  var deg = (degrees >> 0).toFixed(0);
  var min = ((degrees - deg)*60).toFixed(3);
  return (deg + "\xb0" + min + "'");
}

function latitudeString(pos) {
  var degrees = pos.lat;
  var str = degreesString(degrees);
  return (degrees < 0 )?"S" + str:"N" + str;
}

function longitudeString(pos) {
  var degrees = pos.long;
  var str = degreesString(degrees);
  return (degrees < 0 )?"W" + str:"E" + str;
}

// Determine Lat and Long from Canvas XY
function XY2LatLong(point) {
  var dx = (point.x) * map.resolution ;
  var dy = (map.offset - point.y) * map.resolution;
  var pos = map2LatLong({lat: map.datum.lat, long: map.datum.long},{x: dx, y: dy});
  return pos;
}

// Display the Current Waypoint Info
// Pull the data from the Mission data
function updateRouteInfo() {

  var altitude = -mission.targets[properties.waypoint.stpt].data;
  var distance = mission.route[properties.waypoint.stpt].dist.toFixed(1);
  var course = mission.route[properties.waypoint.stpt].crs;

  document.getElementById("stpt-lab").innerHTML = getSteerpointType(properties.waypoint.stpt);
  document.getElementById("stpt-val").innerHTML = (properties.waypoint.stpt + 1);
  document.getElementById("options-val").innerHTML = "No Options";

  if (mission.targets[properties.waypoint.stpt].desc.includes("Not set")) {
    if (mission.targets[properties.waypoint.stpt].action == Action.Takeoff ||
      mission.targets[properties.waypoint.stpt].action == Action.Land) {
      var point = {x: mission.targets[properties.waypoint.stpt].x,
                   y: mission.targets[properties.waypoint.stpt].y};
      var airport =  getAirportNearby(point);
      document.getElementById("options-val").innerHTML = "Airport: " + airport.name;
    }
    else if (mission.targets[properties.waypoint.stpt].action == Action.Refuel &&
             mission.radio.length > 0) {
      var callsign = getCallsignByFreq(mission.radio[12].freq);
      document.getElementById("options-val").innerHTML = "Tanker: " + callsign;
    }
    else {
      if (mission.radio.length > 0 ) {
        var callsign = getCallsignByFreq(mission.radio[4].freq);
        document.getElementById("options-val").innerHTML = "AWACS: " + callsign;
      }
   }
  }
  else {
    document.getElementById("options-val").innerHTML = mission.targets[properties.waypoint.stpt].desc;
  }

  document.getElementById("formation-select").selectedIndex = 12;
  document.getElementById("enroute-select").selectedIndex = 0;
  document.getElementById("action-select").selectedIndex = mission.targets[properties.waypoint.stpt].action;
  document.getElementById("dur-val").value = mission.targets[properties.waypoint.stpt].duration;
  document.getElementById("alt-val").value = altitude >> 0;
  document.getElementById("trk-val").innerHTML = course + "&deg " + distance + "NM";

  var time = tosTime(mission.route[properties.waypoint.stpt].tos).split(":");
  document.getElementById("tos-hrs").selectedIndex = time[0];
  document.getElementById("tos-min").selectedIndex = time[1];
  document.getElementById("tos-sec").selectedIndex = time[2];

  document.getElementById("day-val").value = tosDay(mission.route[properties.waypoint.stpt].tos);
  document.getElementById("tas-val").value = mission.route[properties.waypoint.stpt].spd >> 0;

  // Update the Latitude and Longitude Use either the x y or east north method
  // position = XY2LatLong({x: mission.targets[properties.waypoint.stpt].x,y: mission.targets[properties.waypoint.stpt].y});
  position = map2LatLong(map.datum,{x: mission.targets[properties.waypoint.stpt].east,y: mission.targets[properties.waypoint.stpt].north});
  document.getElementById("lat-val").innerHTML = latitudeString(position);
  document.getElementById("long-val").innerHTML = longitudeString(position);
  //console.log(latitudeString(position),longitudeString(position));
}

// Populate the Radio Frequency tab
function updateRadioInfo() {
  for (i = 0; i < mission.radio.length; i++) {
    var entry = document.getElementById(mission.radio[i].id);
    if (entry) {
      entry.innerHTML = mission.radio[i].freq;
    }
  }
}

function clearOptionList(opt_list) {
  // Clear entity list
  var i, L = opt_list.options.length - 1;
  for(i = L; i >= 0; i--) opt_list.remove(i);
}

// Populate the Mission tab
// Fuel calculations are very rough until I have better fuel consumption data
function updateMissionInfo() {
  var flight_time = getMissionTime();
  var distance = getMissionDistance();
  var dist_max = getMaxHomePlateDistance();
  var wpt_land = getHomePlateIndex();

  if (wpt_land == -1) return;

  // Determine IMC/VMC state (must have .fmap first)
  var x = (mission.targets[wpt_land].x / 65) >> 0;
  var y = (mission.targets[wpt_land].y / 65) >> 0;
  var imc = (isIMC(x,y))?2:1;

  // OLD: var bingo = getFlightHours(320, dist_max) * 5500 + 500;
  // NEW: is (1000 + 400 | 800 + Route distance back NM * 15) lbs
  var bingo = 1000 + 400 * imc + dist_max * 15; // 1000 lbs base + pattern + distance to home
  //var fuel_estimated = 200 + flight_time * 6800 + 100; // taxi fuel and 6800 FF
  var fuel_estimated = getEstimatedFuelUntil(wpt_land);
  var playtime = (mission.pkg.fuel - getMaxHomePlateDistance() * 15 - bingo)/100;
  if (playtime < 0) playtime = 0;

  // Add some rounding
  bingo = Math.ceil(bingo / 100) * 100; // Nearest 100 lbs
  fuel_estimated = Math.ceil(fuel_estimated / 100) * 100; // Nearest 100 lbs
  mission.pkg.bingo = bingo;

  // Update the Package Callsigns in UI first clear and then add
  var flight_list = document.getElementById("pkg-flight");
  clearOptionList(flight_list);
  for (var i=0;i<5; i++) {

    var opt = document.createElement('option');
    opt.value = (i + 1).toString();

    if (mission.radio.length == 40) opt.innerHTML = mission.pkg.flights[i];
    else opt.innerHTML = "Flight" + (i+1);

    flight_list.appendChild(opt);
  }

  // Set Flight Data on Mission Tab
  document.getElementById("flt-dist").innerHTML = distance.toFixed(1);
  document.getElementById("flt-time").innerHTML = flight_time.toFixed(1);
  document.getElementById("flt-fuel").innerHTML = fuel_estimated >> 0;
  document.getElementById("flt-bingo").innerHTML = bingo >> 0;
  document.getElementById("flt-play").innerHTML = playtime >> 0;

  // Set Package and Flight Info
  document.getElementById("pkg-chx").selectedIndex = Math.abs(mission.pkg.chx[mission.pkg.callsign]) - 11;
  document.getElementById("pkg-band").selectedIndex = (mission.pkg.chx[mission.pkg.callsign] > 0)?0:1;
  document.getElementById("pkg-flight").selectedIndex = mission.pkg.callsign;
  document.getElementById("flt-num").innerHTML = (mission.pkg.callsign + 1).toString();
}

function initConnectionUI() {
  var prod = gfsGetAvailableProd();
  var date_list = document.getElementById("gfs-date");
  clearOptionList(date_list);

  // Build the GFS Date List
  for (var i=0;i<prod.length; i++) {
    var opt = document.createElement('option');
    opt.value = prod[i];
    opt.innerHTML = prod[i];
    date_list.appendChild(opt);
  }
}

function openTab(tabName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
    if (tablinks[i].name == tabName) tablinks[i].className += " active";
  }

  // Pre-load content if needed
  if (tabName == "Connections") {
    initConnectionUI();
  }

  document.getElementById(tabName).style.display = "block";
}

// Download Data at URL
function DownloadFile(src, dest){
  let link = new URL(src);
  let downloadLink = document.createElement('a');
  downloadLink.setAttribute('download', dest);
  downloadLink.setAttribute('href', link);
  downloadLink.click();
}

// Save WhiteBoard to image
function SaveWhiteboard(){
  let downloadLink = document.createElement('a');
  downloadLink.setAttribute('download', 'Whiteboard.png');
  layer.whitebrd.canvas.toBlob(function(blob) {
    let url = URL.createObjectURL(blob);
    downloadLink.setAttribute('href', url);
    downloadLink.click();
  });
}

// Export Weather to Fmap
function ExportWeather(){
  // Guard Against Data
  if (fmap.version == 0 ) return;

  // Export Version 8 size only
  let data = new Uint32Array(104441); // Number of elements

  // Populate the data
  fmapExportData(data);

  // Convert to Blob
  var blob = new Blob([data.buffer], {
    type: 'application/x-binary'
  });

  // Create the file
  let downloadLink = document.createElement('a');
  let url = URL.createObjectURL(blob);
  downloadLink.setAttribute('download', fmap.time + ".fmap");
  downloadLink.setAttribute('href', url);
  downloadLink.click();
}

//
// Toolbar Buttons
//
function button(e) {
   var id = e.target.id;
   e.stopImmediatePropagation();

   switch(id) {
    case "move":
        properties.mode = Mode.Move;
        break;

    case "bullseye":
        properties.mode = Mode.Bullseye;
        break;

    case "zoom1":
        if (id == "zoom1" && properties.zoom > limits.zoom_min) {
          if (e.shiftKey) properties.zoom = limits.zoom_min;
          else properties.zoom -= 0.05;
        }
    case "zoom2":
        if (id == "zoom2" && properties.zoom < limits.zoom_max) {
          if (e.shiftKey) properties.zoom = limits.zoom_max;
          else properties.zoom += 0.05;
        }
        scaleView(properties.zoom);
        saveSettings();
        refreshCanvas();
        break;

    case "ruler":
        properties.mode = Mode.Measure;
        break;

    case "symbol":
        properties.mode = Mode.Symbol;
        window.modal = document.getElementById("SIDC");
        window.modal.style.display = "block";
        layer.whitebrd.used = true; // Allow placing units
        break;

    case "pencil":
        // if (properties.mode == Mode.Draw) {
        //   properties.pencil.id = (properties.pencil.id + 1) % 4;
        //   switch (properties.pencil.id) {
        //     case 0: properties.pencil.color = '#0032ff'; break;
        //     case 1: properties.pencil.color = '#00ff00'; break;
        //     case 2: properties.pencil.color = '#ff0000'; break;
        //     case 3: properties.pencil.color = '#000000'; break;
        //   }
        // }
        properties.mode = Mode.Draw;
        properties.pencil.id = 0;
        window.modal = document.getElementById("STYLE");
        window.modal.style.display = "block";
        break;

    case "text":
        properties.mode = Mode.Write;
        break;

    case "eraser":
        properties.mode = Mode.Erase;
        break;

    case "reset":
        if (confirm("Are you sure you want to reset everything?")) {
          window.localStorage.clear();
          clearMissionData();
          resetLayers();
          resetBullseye();
          resetSettings();
        }
        break;

    case "settings":
        properties.mode = Mode.Move;
        window.modal = document.getElementById("CONFIG");
        window.modal.style.display = "block";
        openTab("Settings");
      break;

    case "compass":
      if (layer.mission.used) {
        if (e.shiftKey) {
          centroid = getCentroid();
          window.scrollTo(centroid.x * last_zoom -window.innerWidth/2,centroid.y*last_zoom-window.innerHeight/2);
        }
        else {
          properties.mode = Mode.Move;
          window.modal = document.getElementById("ROUTE");
          window.modal.style.display = "block";
          updateRouteInfo();
          openTab("Route");
        }
      }
    break;

    case "clear":
        if (confirm("Are you sure you want to clear the Whiteboard?")) {
          layer.whitebrd.used = false;
          layer.whitebrd.ctx.clearRect(0,0,layer.whitebrd.canvas.width,layer.whitebrd.canvas.height);
          refreshCanvas();
        }
        break;

    case "save":
        SaveWhiteboard();
    break;

    case "export":
      ExportWeather();
    break;

    case "right":
        if (mission.targets[properties.waypoint.stpt + 1].action != -1) {
          properties.waypoint.stpt++;
          updateRouteInfo();
        }
        break;

    case "left":
        if (properties.waypoint.stpt > 0) {
          properties.waypoint.stpt--;
          updateRouteInfo();
        }
        break;

    case "btn-flight":
        showChart("tableDatacard");
      break;

    case "btn-wx":
      if (fmap.version > 0) showChart("tableWeather");
    break;

    case "btn-alt":
      //showChart("chartAltitudes"); Disabled until Implemented
      break;

    case "imcs-connection":
      if (imcs.client < 0) {
        var host = document.getElementById("imcs-host").value;
        var port = document.getElementById("imcs-port").value;
        var callsign = document.getElementById("imcs-callsign").value;
        var session = document.getElementById("imcs-session").value;
        var secure = document.getElementById("imcs-secure").checked
        var protocol = (secure)?"wss://":"ws://";
        imcsConnect(callsign, session, protocol + host + ":" + port);
      } else {
        imcsDisconnect();
      }
      break;

    case "gfs-fetch":
      break;

    case "download":
      var date_list  = document.getElementById("gfs-date");
      var date_val   = date_list.options[date_list.selectedIndex].value;
      var cycle_list = document.getElementById("gfs-cycle");
      var cycle_val  = cycle_list.options[cycle_list.selectedIndex].value;
      var offset     = document.getElementById("gfs-off").value;
      var gfs_url    = gfsConstructURL(map.datum, date_val, cycle_val, offset);
      var filename   = gfsGetFilename(cycle_val,offset);

      DownloadFile(gfs_url,filename);
      break;

    default: console.log("Unknown button id");
    }
    updateToolbar();
}

/*
 * Mouse or Pointer Actions
 */

// Check if custom or standard handler is preferred for an element name tag
// To have standard HTML lists work you must selec standard handler
function isStandardElement(target) {
  var std = false;
  switch (target) {
    case "airport":
    case "altitudes":
    case "weather":
    case "filter":
    case "line-color":
    case "line-style":
    case "line-width":
    case "fill-style":
    case "fill-color":
    case "erase-rng":
    case "erase-num":
    case "opacity-range":
    case "opacity-num":
    case "sidc-identity":
    case "sidc-set":
    case "sidc-entity":
    case "sidc-sec1":
    case "sidc-sec2":
    case "action":
    case "formation":
    case "enroute":
    case "hrs":
    case "min":
    case "sec":
    case "tas":
    case "alt":
    case "dur":
    case "package":
    case "flight":
    case "seat":
    case "channel":
    case "band":
    case "fuel":
    case "callsign":
    case "host":
    case "port":
    case "session":
    case "date":
    case "cycle":
    case "offset":
      std = true;
      break;
    default:
      std = false;
      break;
  }

  return std;
}

// Pointer Event Handlers
var pointer_start = function(e) {
  var target = e.target.name;
  properties.shifted = e.shiftKey;
  properties.ctrl = e.metaKey | e.ctrlKey;

  // Close out the free text writing if we switch Mode
  if (properties.mode == Mode.Write && isToolbarButton(e)) {
    e.preventDefault();
    writeText();
    button(e);
    return;
  }

  // Check for Standard HTML behavior or not
  if (isStandardElement(target)) return;

  // Custom Event Response
  e.preventDefault();
  if (!isToolbarButton(e) && window.modal == undefined) window.origin = {x:e.pageX, y:e.pageY};

  // In Write mode allow user the write on Whiteboard
  if (properties.mode == Mode.Write) {
    if (properties.text.typing) writeText(); // Commit to the Whiteboard
    typeText(); // Enter text in text area
  }
}

function updateCursorData(e) {
  var cursor_val = " ";

  if (properties.settings.visibility.coordinates) {
    var scalar = 3840 / canvas.height;
    var map_x = (e.pageX * scalar) >> 0;
    var map_y = (e.pageY * scalar) >> 0;
    var position = XY2LatLong({x: (e.pageX ) * scalar, y:(e.pageY) * scalar});
    cursor_val = String(latitudeString(position) + " " + longitudeString(position) + (" x:")+ map_x + ", y:" + map_y);
  }
  document.getElementById("cursor-val").innerHTML = cursor_val;
}

// pointer drag routine
var imcs_limiter = 0;
var pointer_drag = function(e) {
  var target = e.target.name;
  properties.shifted = e.shiftKey;
  properties.ctrl = e.metaKey | e.ctrlKey;

  // Early guard for Standard behavior
  if (isStandardElement(target)) return;

  // Update Cursor Info
  updateCursorData(e);

  // Custom processing
  e.preventDefault();

  // Alow drag operations when we are not clicking toolbar and have no modal displayed
  if (window.origin) {
    var scale = 1 / properties.zoom;

    switch(properties.mode) {
      case Mode.Measure:
        refreshCanvas();
        drawRuler(context, {x: window.origin.x, y: window.origin.y}, {x: e.pageX, y: e.pageY});
        break;

      // Scroll Canvas
      case Mode.Move:
        var dx = window.origin.x - e.clientX;
        var dy = window.origin.y - e.clientY ;
        window.scrollTo(dx, dy);
        break;

      // Whiteboard drawing
      case Mode.Draw:
        layer.whitebrd.used = true;
        context.lineWidth = 2 * properties.zoom;
        if (properties.shifted == true ) {
          refreshCanvas();
          drawLine(context, style, {x: window.origin.x, y: window.origin.y}, {x: e.pageX, y: e.pageY});
        }
        else if (properties.ctrl == true ) {
          refreshCanvas();
          drawEllipse(context, style, {x: window.origin.x, y: window.origin.y}, {x: e.pageX, y: e.pageY});
        }
        else {
          drawMarker(context, style, {x: window.origin.x, y: window.origin.y}, {x: e.pageX, y: e.pageY});
          layer.whitebrd.ctx.lineWidth = (2);
          drawMarker(layer.whitebrd.ctx, style, {x: window.origin.x * scale, y: window.origin.y * scale}, {x: e.pageX * scale, y: e.pageY *scale});
          imcsMsgMarkerSend(style, window.origin.x * scale, window.origin.y * scale, e.pageX  * scale, e.pageY  * scale);
          window.origin.x = e.pageX;
          window.origin.y = e.pageY;
        }
        break;

      case Mode.Symbol:
        layer.whitebrd.used = true;
          refreshCanvas();
          context.drawImage(properties.entity.img, (e.pageX - 16 * properties.zoom), (e.pageY - 16*properties.zoom), 32 * properties.zoom, 32 * properties.zoom);
        break;

      // Whiteboard Eraser
      case Mode.Erase:
        eraseMarker(layer.whitebrd.ctx,e.pageX * scale,e.pageY*scale, properties.eraser.dimension);
        imcsMsgEraseSend(properties.eraser.dimension, e.pageX * scale, e.pageY*scale );
        refreshCanvas();
        break;

      // Move Bullseye
      case Mode.Bullseye:
        if (bullseye.show && !isToolbarButton(e)) {
          bullseye.x = e.pageX;
          bullseye.y = e.pageY;
          refreshCanvas();
        }
        break;

      default:
        break;
      }
    } else {
      // Draw Laser Pointer if Ctrl pressed.
      if (properties.ctrl == true && properties.mode == Mode.Move) {
        properties.pointer = true;
        var scalar = 3840 / canvas.height;
        var map_x = (e.pageX * scalar) >> 0;
        var map_y = (e.pageY * scalar) >> 0;
        drawPointer(context, properties.pointer, {x: e.pageX, y: e.pageY});

        // Throttle pointer updates to remote browsers
        if ((imcs_limiter++ % 4) == 0) imcsMsgPointerSend(properties.pointer, map_x, map_y);
      } else if (properties.pointer){
          properties.pointer = false;
          drawPointer(context, properties.pointer, {x: e.pageX, y: e.pageY});
          imcsMsgPointerSend(properties.pointer, map_x, map_y );
        }
    }
}

// Pointer end on mouse release
var pointer_end = function(e) {
  if (window.origin) {
    var scale = 1 / properties.zoom;

    if (properties.mode == Mode.Draw) {
      layer.whitebrd.ctx.lineWidth = 2;
      if (properties.shifted) {
        drawLine(layer.whitebrd.ctx, style, {x: window.origin.x * scale, y: window.origin.y * scale},
         {x: e.pageX  * scale, y: e.pageY  * scale});
         imcsMsgLineSend(style, window.origin.x * scale, window.origin.y * scale, e.pageX  * scale, e.pageY  * scale);
      }
      else if (properties.ctrl) {
        drawEllipse(layer.whitebrd.ctx, style, {x: window.origin.x * scale, y: window.origin.y * scale},
         {x: e.pageX  * scale, y: e.pageY  * scale});
         imcsMsgEllipseSend(style, window.origin.x * scale, window.origin.y * scale, e.pageX  * scale, e.pageY  * scale);
      }
    }
    if (properties.mode == Mode.Symbol && !isToolbarButton(e)){
      layer.whitebrd.ctx.drawImage(properties.entity.img, e.pageX  * scale - 16, e.pageY  * scale - 16);
      imcsMsgSymbolSend(properties.entity.sidc,e.pageX  * scale,e.pageY  * scale);
    }

    // Refresh only for these modes
    if (properties.mode == Mode.Measure || properties.mode == Mode.Bullseye ||
        properties.mode == Mode.Draw || properties.mode == Mode.Symbol) {
          if (properties.mode == Mode.Bullseye) {
            imcsMsgBullseyeSend(bullseye.x / properties.zoom, bullseye.y / properties.zoom);
          }
          refreshCanvas();
    }

    window.origin = null;
  }
  properties.shifted = false;
  properties.ctrl = false;
}

var wheel_enabled = true;
function enable_wheel() {
  wheel_enabled = true;
}

// Allow zooming with the mouse but limit it to a set wheel rate
// See Limiters (20 hz) and set discrete steps
var mouse_zoom = function(e) {
  e.preventDefault();
  
  // Normalize deltaY to a consistent step (e.g., 0.1 zoom per scroll)
  var zoomStep = Math.sign(e.deltaY) * 0.1; // Adjust step size as needed
  var newZoom = properties.zoom - zoomStep;

  // Ensure zoom stays within limits and apply rounding to avoid floating-point drift
  if (wheel_enabled && newZoom >= limits.zoom_min && newZoom <= limits.zoom_max) {
    properties.zoom = Math.round(newZoom * 100) / 100; // Round to 2 decimal places
    scaleView(properties.zoom);
    saveSettings();
    refreshCanvas();
    wheel_enabled = false;
    setTimeout(function() {
      wheel_enabled = true;
    }, (1 / limits.wheel_rate_hz) * 1000);
  }
};

//
//  Canvas and Layer Routines
//

// is the a valid line segmenst for routes and lines?
function isLineSegment(from,to) {
   return ((from.x > 0 || from.y < map.offset) && (to.x > 0 || to.y < map.offset));
}

// Clear and Refresh the Canvas with persistent objects
function refreshCanvas(){

  // Clear the Main Canvas
  context.clearRect(0,0,canvas.width,canvas.height);

  // Clear the Mission Layer and draw once when mission is loaded
  if ( mission.changed ) {
     properties.waypoint.stpt = 0;
     mission.changed = false;
     layer.mission.used = true;
     layer.mission.ctx.clearRect(0,0,layer.mission.canvas.width,layer.mission.canvas.height);
     if (mission.ppts.length > 0 ) drawPrePlannedThreats(layer.mission.ctx, mission.ppts);
     if (mission.lines.length > 0 ) drawLineSteerPoints(layer.mission.ctx, mission.lines);
     if (mission.targets.length > 0 ) drawRoute(layer.mission.ctx, mission.targets);

     // Update radio Frequencies
     updateRadioInfo();

     // Update mission data
     updateMissionInfo();

    // Focus on Mission Centroid
     centroid = getCentroid();
     window.scrollTo(centroid.x * last_zoom -window.innerWidth/2,centroid.y*last_zoom-window.innerHeight/2);
  }

  // Draw Weather quickly
  if ((fmap.changed || chart_changed) && fmap.version > 0) {
    fmap.changed = false;
    chart_changed = false;
    layer.weather.used = true;
    layer.weather.ctx.clearRect(0,0,layer.weather.canvas.width,layer.weather.canvas.height);
    switch (properties.settings.weather) {
      case 0:
        drawDopplerRadar(layer.weather.ctx);
        break;

      case 1:
        drawWinds(layer.weather.ctx);
        break;

      case 2:
        drawTemperatures(layer.weather.ctx);
        break;

      case 3:
        drawIsoBars(layer.weather.ctx);
        break;

      case 4:
        drawClouds(layer.weather.ctx);
        break;
    }
  }

  // Render the layers on the Main Canvas
  var img_size = 3840 * properties.zoom;
  if (layer.weather.used && properties.settings.visibility.weather) {
    context.drawImage(layer.weather.canvas,0, 0,img_size,img_size);

    // Don't draw weather over the legend
    clearLegend(context);
  }

  // Draw Bullseye annotation
  if (properties.settings.visibility.bullseye) {
    drawBullseye(context, bullseye.x, bullseye.y );
    clearLegend(context);
  }

  if (layer.mission.used && properties.settings.visibility.mission) {
    context.drawImage(layer.mission.canvas,0, 0, img_size,img_size);
  }

  // Add Whiteboard
  if (layer.whitebrd.used && properties.settings.visibility.whitebrd) {
    context.drawImage(layer.whitebrd.canvas,0, 0, img_size, img_size);
  }
}

function setupLayer(layer, width, height) {
  layer.canvas.width = width;
  layer.canvas.height = height;
  layer.ctx = layer.canvas.getContext("2d");
}

var last_zoom = 1;
function scaleView(zoom, event) { // Add event parameter to capture mouse position
  var dimension = 3840 * properties.zoom;
  var dim_str = dimension.toString() + "px";
  var scale = properties.zoom / last_zoom;

  var scroll_element = document.scrollingElement;
  var client_width = scroll_element.clientWidth;
  var client_height = scroll_element.clientHeight;

  // Get mouse position relative to the viewport
  var mouseX = event ? event.clientX : client_width / 2; // Fallback to center if no event
  var mouseY = event ? event.clientY : client_height / 2;

  // Calculate mouse position relative to the document before scaling
  var doc_mouseX = scroll_element.scrollLeft + mouseX;
  var doc_mouseY = scroll_element.scrollTop + mouseY;

  // Update map dimensions
  var base_map = document.getElementById('map');
  base_map.style.width = dim_str;
  base_map.style.height = dim_str;

  var ovly_map = document.getElementById('airbases');
  ovly_map.style.width = dim_str;
  ovly_map.style.height = dim_str;
  window.canvas.width = dimension;
  window.canvas.height = dimension;

  // Scale bullseye coordinates
  bullseye.x *= scale;
  bullseye.y *= scale;

  // Scale the airport coordinates on the image map
  scaleMap(scale);

  // Calculate new scroll position to keep mouse point fixed
  var new_doc_mouseX = doc_mouseX * scale;
  var new_doc_mouseY = doc_mouseY * scale;
  scroll_element.scrollLeft = new_doc_mouseX - mouseX;
  scroll_element.scrollTop = new_doc_mouseY - mouseY;

  last_zoom = properties.zoom;
}

function resetLayers() {
  layer.mission.ctx.clearRect(0,0,canvas.width,canvas.height);
  layer.mission.used = false;
  layer.whitebrd.ctx.clearRect(0,0,canvas.width,canvas.height);
  layer.whitebrd.used = false;
  layer.weather.ctx.clearRect(0,0,canvas.width,canvas.height);
  layer.weather.used = false;
}

// Set the default bullseye based on the bullseye defined in the image map.
function resetBullseye() {
  // Set Initial bullseye based on Theater from HTML Image Map
  if (bullseye.coords != 0) {
    var bullseye_coords = bullseye.coords.split(",");
    bullseye.x = parseFloat(bullseye_coords[0]);
    bullseye.y = parseFloat(bullseye_coords[1]);
  }
  bullseye.show = true;
}

// Handle Saving and Restoring Settings
function refreshSettings() {
  // Properties
  document.getElementById("unit").checked = !properties.settings.metric;
  document.getElementById("alt-select").value = properties.settings.altitude;
  document.getElementById("wx-select").value = properties.settings.weather;
  document.getElementById("flt-select").value = properties.settings.filter;
  document.getElementById("bullseye_hide").checked = !properties.settings.visibility.bullseye;
  document.getElementById("mission_hide").checked = !properties.settings.visibility.mission;
  document.getElementById("weather_hide").checked = !properties.settings.visibility.weather;
  document.getElementById("whitebrd_hide").checked = !properties.settings.visibility.whitebrd;
  document.getElementById("coordinates_hide").checked = !properties.settings.visibility.coordinates;

  // Mission Presets (for SOP)
  document.getElementById("pkg-chx").selectedIndex = Math.abs(mission.pkg.chx[mission.pkg.callsign]) - 11;
  document.getElementById("pkg-band").selectedIndex = (mission.pkg.chx[mission.pkg.callsign] > 0)?0:1;

  // Connection Presets
  document.getElementById("imcs-callsign").value = properties.connection.callsign;
  document.getElementById("imcs-session").value = properties.connection.session;
  document.getElementById("imcs-host").value = properties.connection.host;
  document.getElementById("imcs-port").value = properties.connection.port;
  document.getElementById("imcs-secure").checked = properties.connection.secure;
}

function saveSettings() {
  // Basic Settings to Keep
  window.localStorage.setItem("metric",properties.settings.metric.toString());
  window.localStorage.setItem("zoom",properties.zoom.toString());
  window.localStorage.setItem("altitude",properties.settings.altitude.toString());
  window.localStorage.setItem("chart",properties.settings.weather.toString());
  window.localStorage.setItem("bullseye",properties.settings.visibility.bullseye.toString());
  window.localStorage.setItem("mission",properties.settings.visibility.mission.toString());
  window.localStorage.setItem("weather",properties.settings.visibility.weather.toString());
  window.localStorage.setItem("whitebrd",properties.settings.visibility.whitebrd.toString());
  window.localStorage.setItem("coordinates",properties.settings.visibility.coordinates.toString());

  // Mission Presets ( for SOP )
  window.localStorage.setItem("yardstick",mission.pkg.chx.toString());

  // Connection Settings
  window.localStorage.setItem("callsign",properties.connection.callsign);
  window.localStorage.setItem("session",properties.connection.session);
  window.localStorage.setItem("host",properties.connection.host);
  window.localStorage.setItem("port",properties.connection.port);
  window.localStorage.setItem("secure",properties.connection.secure.toString());
}

function loadSettings() {
  properties.settings.metric = (window.localStorage.getItem("metric") === "true");
  properties.settings.altitude = Number(window.localStorage.getItem("altitude"));
  properties.settings.weather = Number(window.localStorage.getItem("chart"));
  properties.settings.visibility.bullseye = (window.localStorage.getItem("bullseye") === "true");
  properties.settings.visibility.mission = (window.localStorage.getItem("mission") === "true");
  properties.settings.visibility.weather = (window.localStorage.getItem("weather") === "true");
  properties.settings.visibility.whitebrd = (window.localStorage.getItem("whitebrd") === "true");
  properties.settings.visibility.coordinates = (window.localStorage.getItem("coordinates") === "true");

  // Connection Settings
  properties.connection.callsign = window.localStorage.getItem("callsign");
  properties.connection.session = window.localStorage.getItem("session");
  properties.connection.host = window.localStorage.getItem("host");
  properties.connection.port = window.localStorage.getItem("port");
  properties.connection.secure = (window.localStorage.getItem("secure") === "true");

  mission.pkg.chx = String(window.localStorage.getItem("yardstick")).split(",");

  // Restore Zoom Level
  properties.zoom = Number(window.localStorage.getItem("zoom"));
  if (properties.zoom == 0) {
    // Initialize the Settings
    properties.zoom = 1;
    resetSettings();
  }

  // Restore Mission Yardstick SOP
  if (mission.pkg.chx.length < 2) {
    mission.pkg.chx = [15,16,17,18,19];
  }

  // Set the backgroud prefered color mode
  var bg_img = document.getElementById('map');
  if (properties.settings.filter == 1) {
    bg_img.setAttribute('class', 'background_mono');
  }
  else {
    bg_img.setAttribute('class', 'background');
  }

  refreshSettings();
}

function resetSettings() {

  // Reset Properties
  properties.settings = {
    metric: true,
    altitude: 0,
    weather: 2,
    color: 0,
    visibility: {
      bullseye: true,
      mission: true,
      weather: true,
      whitebrd: true,
      coordinates: false
    }
  };

  // Reset Mission settings
  mission.pkg.chx = [15,16,17,18,19];

  saveSettings();
  refreshSettings();
}

// Set the entity names to the correct Set and Identity
function setupSymbolsList(sidc) {
  var entity_list = document.getElementById("sidc-entity");

  // Clear entity list
  //var i, L = entity_list.options.length - 1;
  //for(i = L; i >= 0; i--) entity_list.remove(i);
  clearOptionList(entity_list);

  // Add Entities
  entity = firstSymbol(sidc);

  while (entity) {
      var opt = document.createElement('option');
      opt.value = entity.sidc;
      opt.innerHTML = entity.entity;
      entity_list.appendChild(opt);
      // console.log(opt.value,opt.innerHTML);

      entity = nextSymbol(sidc);
  }
}

function initTimeOptions() {
  var hrs_list = document.getElementById("tos-hrs");
  var min_list = document.getElementById("tos-min");
  var sec_list = document.getElementById("tos-sec");

  clearOptionList(hrs_list);
  clearOptionList(min_list);
  clearOptionList(sec_list);

  // Add the Hours
  for (var i=0;i<24;i++) {
    var opt = document.createElement('option');
    var val = (i.toString().length == 1)?"0"+i.toString():i.toString();
    opt.value = i;
    opt.innerHTML = val;
    hrs_list.appendChild(opt);
  }
  hrs_list.selectedIndex = 9;


   // Add the Minutes
   for (var i=0;i<60;i++) {
    var opt = document.createElement('option');
    var val = (i.toString().length == 1)?"0"+i.toString():i.toString();
    opt.value = i;
    opt.innerHTML = val;
    min_list.appendChild(opt);
  }

    // Add the Minutes
    for (var i=0;i<60;i++) {
    var opt = document.createElement('option');
    var val = (i.toString().length == 1)?"0"+i.toString():i.toString();
    opt.value = i;
    opt.innerHTML = val;
    sec_list.appendChild(opt);
  }

}

/*
 * MAIN Page Loader handler
 *
 * Setup the page by defining the airport selection list,
 * setup the Render layerd and register event handlers
 */
window.onload = function(e) {

  // Restrore Settings
  loadSettings();

  // Create the Airport Selection List from the image map
  var select = document.getElementById("airports");
  var imageMap = document.getElementById("imgMap");
  var map_datum = imageMap.getAttribute("data-map-datum").split(",");
  var areas  = imageMap.children;
  var groups = [];

  // Add the map entries to their option group
  for(let i = 0; i < imageMap.childElementCount; i++) {
    var group;
    const index = groups.findIndex(group => {return group.label === areas[i].alt;});
    if (index < 0) {
        if (areas[i].alt == "Legend" || areas[i].alt == "Bullseye") continue;
        group = document.createElement("optgroup");
        group.setAttribute('label', areas[i].alt);
        groups.push(group);
        select.appendChild(group);
    }
    else {
        group = groups[index];
    }
    group.appendChild(new Option(areas[i].title, i));
  }

  // Initialize the Symbol entities based on Land Unit and Hostile selection
  setupSymbolsList("1006100016");
  selectSymbols(document.getElementById("sidc-entity"));

  // Setup the Time picker
  initTimeOptions();

  // Setup the main canvas for the view
  window.canvas = document.getElementById("annotation");
  window.context = canvas.getContext("2d", { willReadFrequently: true });
  window.context.globalAlpha   = 1;

    // Adjust map to used scale
  // Safari will slow beyond 3840 canvas size
  storeMapCoordinates();
  scaleMap(3840/4096);
  storeMapCoordinates();

  // Setup the Layers to be rendered on the main canvas
  setupLayer(layer.mission, canvas.width, canvas.height );
  setupLayer(layer.whitebrd, canvas.width, canvas.height );
  setupLayer(layer.weather, canvas.width, canvas.height );

  // Determine Map Properties
  map.pixels = canvas.height;
  map.resolution = map.feet / map.pixels;
  map.offset = map.pixels;
  map.datum.lat = parseFloat(map_datum[0]);
  map.datum.long = parseFloat(map_datum[1]);

  // Setup Bullseye based on Theater
  resetBullseye();

  // Add Pointer handlers
  // It is possible to enable measurment with pointerdown, pointermove and pointerup
  // but on your tablet to measure you need three fingers to pinch hold and then measure
  // You can replace the mouse events with the above respective pointer events if you want to try
  // the annoying way of measuring on a tablet. Maybe a a tablet pencil will help.
  this.addEventListener('mousedown', pointer_start);
  this.addEventListener('mousemove', pointer_drag);
  this.addEventListener('mouseup',   pointer_end);
  this.addEventListener("wheel",     mouse_zoom,   {passive:false} );

  // Trigger a Render
  updateToolbar();

  // Set Initial focus on Bullseye on load
  window.scrollTo(bullseye.x-window.innerWidth/2,bullseye.y-window.innerHeight/2);

  // Draw the Layers
  enable_wheel();
  scaleView(properties.zoom);
  refreshCanvas();
}
