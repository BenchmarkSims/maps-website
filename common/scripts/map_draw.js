//
// Drawing Routines for BMS Interactive Maps
//
// All routines must be passed a ctx so it can be rendered on any
// layer desired.

// dependencies:
//   map_math.js
var style = {
    line: {
        color: '#000000',
        style: [],
        width: 2,
    },
    fill: {
        mode: 0,  // 0: None, 1: Color
        color: '#000000',
        opacity: 0.2,
    }
};

// Weather tyoe icons
var img_wx = [];
img_wx.push(new Image());
img_wx.push(new Image());
img_wx.push(new Image());
img_wx.push(new Image());
img_wx.push(new Image());

// Weather Type Icon files
img_wx[0].src = '../common/assets/icon_wx1.png';
img_wx[1].src = '../common/assets/icon_wx2.png';
img_wx[2].src = '../common/assets/icon_wx3.png';
img_wx[3].src = '../common/assets/icon_wx4r.png';
img_wx[4].src = '../common/assets/icon_wx4s.png';

// Draw the highlight circle
function drawHighlight(ctx,x,y,r) {
    ctx.beginPath();
    ctx.arc(x,y,r, 0, 2 * Math.PI, false);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.closePath();
    ctx.stroke();
}

// Draw Multiline text if needed
function drawText(ctx, text, x, y) {
    ctx.fillStyle = '#ffffff'; // White
    ctx.font = '32px sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++)  ctx.fillText(lines[i], x, 19 + y + i * 37);
}

// Draw Bullseye
function drawBullseye(ctx, x, y) {
    var radius = 0;

    // Set line properties
    ctx.setLineDash([]);
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;

    // Draw Radial Circles
    for (var i=0; i < 6;i++){
      ctx.beginPath();
      radius += (30 * properties.zoom) * 6076.12 / map.resolution;
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw Degree Lines
    radius += 30 * properties.zoom;
    var rad = 0;
    for (var i= 0; i < 12 ;i++){
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.sin(rad)*radius), y - (Math.cos(rad)*radius));
      rad += (Math.PI / 6);
      ctx.stroke();
    }
}

// Draw a single Preplanned Threat
function drawPrePlannedThreat(ctx, ppt) {
    if (ppt.x > 0 || ppt.y < map.offset || ppt.z > 0) {
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = "rgba(255, 0, 0, 0.08)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ppt.x, ppt.y, ppt.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.font = '16px courier-new';
        ctx.strokeText(ppt.desc,ppt.x - 16, ppt.y + 8,100);
        ctx.stroke();
    }
}

// Draw all Preplanned Threats
function drawPrePlannedThreats(ctx, list) {
    ctx.setLineDash([]);
    for (var i = 0; i < list.length; i++)  {
        drawPrePlannedThreat(ctx, list[i]);
    }
}

// Draw Line Steer Point Segement
function drawLineSTPT(ctx, from,to) {
    if (isLineSegment(from,to)) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
}

// Draw all Line Steer Points
function drawLineSteerPoints(ctx, list) {
    // Set Line Properties
    ctx.setLineDash([15,5]);
    ctx.strokeStyle = '#000000';

    // Go throug the line list with maxium of 5 segments
    for (var i = 1; i < list.length; i++) if ((i % 6)) drawLineSTPT(ctx, list[i-1],list[i]);
}

// Draw Waypoints (i.e. targets)
function drawWaypoint(ctx, waypoint, id) {
    if ((waypoint.x > 0 || waypoint.y < map.offset)) {
        ctx.lineWidth = 3;
        ctx.beginPath();

        // Draw Shape based on Action
        switch (waypoint.action) {
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
                ctx.moveTo(waypoint.x - 8, waypoint.y + 8);
                ctx.lineTo(waypoint.x, waypoint.y - 8);
                ctx.lineTo(waypoint.x + 8, waypoint.y + 8);
                ctx.lineTo(waypoint.x - 8, waypoint.y + 8);
                break;
            default:
                ctx.arc(waypoint.x, waypoint.y, 8, 0, 2 * Math.PI);

        }
        ctx.stroke();

        // Add Waypoint Number
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.font = '16px courier-new';
        ctx.strokeText(id,waypoint.x, waypoint.y - 16,100);
    }
}

// Draw Route
function drawRoute(ctx, list) {
var endRoute = false;
const px2nm = 6.95; // pixel to Nm scaler

// Set Line Properties
ctx.setLineDash([]);
ctx.strokeStyle = '#ffffff';

// Go throug the target list.
    for (var i = 0; i < 23; i++)  {

        var point1 =  {x: list[i].x, y: list[i].y};
        var point2 =  {x: list[i+1].x, y: list[i+1].y};

        if (endRoute == false && isLineSegment(point1, point2)) {
            var vec = vector(point1, point2);
            var mid = midpoint(point1, point2)
            drawLineSTPT(ctx, point1, point2);
            ctx.lineWidth = 1;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.fillRect(mid.x-3, mid.y-3, 6, 6);
            ctx.stroke();
            ctx.strokeText((vec.magnitude / px2nm).toFixed(1), mid.x - 20, mid.y - 8, 40 );

            // Only draw lines up to landing
            if (list[i + 1].action == 7) endRoute = true;
        }
        drawWaypoint(ctx, list[i],(i+1));
    }
}

// Draw the ruler for Measurement
function drawMeasurement(ctx,x,y,distance,radians) {
    var px2nm = 6.95; // pixel to Nm scaler
    var xPos = x - 50;
    var yPos = y - 12;
    var degrees = rad2deg(radians);
    var distance = Math.round(distance / (px2nm * properties.zoom));
    ctx.lineWidth = 1;
    ctx.font = '16px courier-new';
    ctx.fillRect(xPos,yPos,115,24);
    ctx.fillStyle = 'white';
    ctx.fillText( degrees + "\xb0 / " + distance + " NM",xPos + 8, yPos + 18, 100);
}

var clip = {x: 0, y: 0, data: null };
function drawPointer(ctx,state, point) {

    if (clip.data != null) {
        // Restore Background Clip
        ctx.putImageData(clip.data,clip.x, clip.y);
        clip.data = null;
    }
    if (state) {
        // Capture Background clip
        clip.x = point.x - 6;
        clip.y = point.y - 6;
        clip.data = ctx.getImageData(clip.x,clip.y,12,12);

        // Draw Laser pointer
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.fillStyle = '#ff0000';
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1.0
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Draw the Ruler for measurment
function drawRuler(ctx, from, to) {
    var vec = vector({x: from.x, y: from.y}, {x: to.x, y: to.y});
    var mid = midpoint({x: from.x, y: from.y}, {x: to.x, y: to.y});

    ctx.strokeStyle = '#383b79';
    ctx.fillStyle = '#383b79';
    ctx.setLineDash([]);
    ctx.lineWidth = 2 * properties.zoom;
    ctx.beginPath();
    ctx.fillRect(from.x - 3,from.y -3, 6,6);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    drawMeasurement(ctx,mid.x,mid.y,vec.magnitude, vec.direction);
    ctx.stroke();
}

function drawStyle(ctx, style) {
    ctx.strokeStyle = style.line.color;
    ctx.lineWidth = style.line.width * properties.zoom;
    ctx.setLineDash(style.line.style);
    if (style.fill.mode == 1) {
        ctx.fillStyle = style.fill.color;
    }
}

// Draw Marker (dry eraser)
function drawMarker(ctx, style, from, to){
    // Line properties
    drawStyle(ctx, style);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

// Draw Line
function drawLine(ctx, style, from, to) {
    drawStyle(ctx, style);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

// Draw Circle
function drawCircle(ctx, style, from, to) {
    var radius = vector(from,to);
    drawStyle(ctx, style);
    ctx.beginPath();
    ctx.arc(from.x,from.y, radius.magnitude, 0, 2 * Math.PI);
    if (style.fill.mode == 1) {
        ctx.globalAlpha = style.fill.opacity;
        ctx.fill();
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

// Draw Ellipse
function drawEllipse(ctx, style, from, to) {
    var radius = vector(from,to);
    var xr = Math.abs(to.x - from.x);
    var yr = Math.abs(to.y - from.y);
    drawStyle(ctx, style);
    ctx.beginPath();
    ctx.ellipse(from.x,from.y, xr, yr , 0, 0, 2 * Math.PI);
    if (style.fill.mode == 1) {
        ctx.globalAlpha = style.fill.opacity;
        ctx.fill();
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

function eraseMarker(ctx, x, y, dim){
    ctx.clearRect(x-dim/2,y-dim/2,dim,dim);
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + ((r) << 16) + ((g) << 8) + (b)).toString(16).slice(1);
}

function getDopplerColor(scan) {
    var intensity = 0;
    var calibration = 20;
    var variation = 0;

    // Rain Colors
    if (scan > 0) {
        variation = Math.round((Math.random()*calibration*scan));
        intensity = rgbToHex(200+ variation,15+ variation,(5 + variation));
        if (scan < 4) intensity = rgbToHex(25+ variation,75+ variation,10 + variation);   // Dark Green
        if (scan < 3) intensity = rgbToHex(52+ variation,120+ variation,25 + variation); // Green
        if (scan < 2) intensity = rgbToHex(62+ variation,140+ variation,39 + variation);   // Light Green
    }

    // Snow Colors
    if (scan < 0) {
        variation = Math.round((Math.random()*calibration*scan));
        scan = -scan;
        intensity = rgbToHex(90,90,(115 + calibration)); // Dark Purple
        if (scan < 4) intensity = rgbToHex(180,180,(230 -calibration + variation));   //Purple
        if (scan < 3) intensity = rgbToHex(200,200,(200 -calibration + variation)); // Light
        if (scan < 2) intensity = rgbToHex(255,255,(255 -calibration + variation));   // White
    }

    return intensity;
}

// Draw the Radar from the fmap
function drawDopplerRadar(ctx) {
    // Guard
    if (fmap.type.length == 0) return;

    // Set Transparency
    ctx.globalAlpha = 0.6;

    var size = 20;
    var degrees = 1.5;
    var sweep = 0.0174533 * degrees;

    ctx.lineWidth = size;
    for (radius = size; radius < 1900; radius += size) {
        for (arc = 0; arc < Math.PI*2; arc += sweep) {
            var cell = { magnitude: radius , direction: arc};
            var point = vec2XY(cell);
            var x = ((point.x + 1920) / 65) >> 0;
            var y = ((point.y + 1920) / 65) >> 0 ;
            if (x > 58) x = 58;
            if (y > 58) y = 58;

            var scan = dopplerSense(x,y);
            var occluded = ((Math.random() * 15) >> 0) > 13;
            if (scan != 0 && !occluded) {
                ctx.beginPath();
                ctx.strokeStyle = getDopplerColor(scan);
                ctx.arc(1920,1920, radius, arc, arc + sweep);
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    // Reset Draw Propertis
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
}

// Draw the Satellite Image from the fmap
function drawClouds(ctx) {
    // Guard for missing Data
    if (fmap.cloud.cover.length == 0) return;

    // Gaussian blur is intense so keep the image relatively small
    // then upscale so we still get the cloud effects but fast
    var canvas = document.createElement("canvas");
    canvas.width = 472;
    canvas.height = 472;
    var winds = canvas.getContext("2d");

    winds.filter = "blur(4px)";
    winds.fillStyle = 'white';

    // Draw cloud coverage
    for (var y=0; y < fmap.dimension.y;y++) {
        for (var x = 0; x < fmap.dimension.x;x++) {

            var coverage = fmap.cloud.cover[y][x];
            if (coverage < 3) continue; // Dump FEW

            // 0.4 + 0.6 / 13 steps
            winds.globalAlpha = 0.4 + coverage * 0.046;
            winds.fillRect(x*8,y*8,8,8);
        }
    }

    winds.filter = "none";
    winds.globalAlpha = 1.0;
    ctx.drawImage(canvas,0, 0, 3840,3840);
}

function drawWinds(ctx) {
    if (fmap.wind.length == 0) return;

    var alt = properties.settings.altitude;

    var canvas = document.createElement("canvas");
    canvas.width = 65;   // 3840 / fmap.dimension.x
    canvas.height = 65;  // 3840 / fmap.dimension.y;
    var cell = canvas.getContext("2d");

    cell.strokeStyle = '#383b79'; // Black
    ctx.fillStyle = '#383b79'; // Black
    cell.lineWidth = 2;

    // Draw Wind barb for each cell
    for (var y=0; y < fmap.dimension.y;y++) {
        for (var x = 0; x < fmap.dimension.x;x++) {

            var speed = fmap.wind[y][x][alt].speed;
            var direction = fmap.wind[y][x][alt].direction;

            cell.clearRect(0,0,canvas.width,canvas.height);
            cell.translate(canvas.width/2,canvas.height/2);
            cell.rotate(deg2rad(direction));

            // Draw Wind Direction
            cell.beginPath();
            cell.moveTo(0, 25);
            cell.lineTo(0, -25);
            cell.stroke();

            // Draw 50kts annotation
            var i = 0;
            while (speed - 50 > 0) {
                cell.beginPath();
                cell.moveTo(0, -25 + i);
                cell.lineTo(16, -25 + i);
                cell.lineTo(0, -25 + i + 7);
                cell.closePath();
                cell.stroke();
                cell.fill();
                speed -= 50;
                i+=7;
            }

            // Draw 10kts annotation
            var i = 0;
            cell.beginPath();
            while (speed - 10 > 0) {
                cell.moveTo(0, -25 + i);
                cell.lineTo(20, -25 + i);
                speed -= 10;
                i+=7;
            }

            // Draw 5kts annotation
            if (speed > 0) {
                cell.moveTo(0, -25 + i);
                cell.lineTo(10, -25 + i);
            }
            cell.stroke();

            // Draw the Wind bard on the Weather canvas layer
            ctx.drawImage(canvas,x * 65, y * 65);
            cell.resetTransform();
        }
    }
}

function drawTemperatures(ctx) {
    // Guard for missing Data
    if (fmap.type.length == 0 || fmap.temperature.length == 0) return;

    var shift = 0;
    var temp;

   ctx.font = '40px serif';
   ctx.beginPath();

    for (var y=5; y < fmap.dimension.y;y+=5) {
        if (y % 10 ) shift = 5;
        else shift = 0;
        for (var x = 0; x < fmap.dimension.x - 5;x+=5) {
            if ((x + shift) == 0 || x % 10) continue;

            // Check the weather type and temperature for snow
            temp = (fmap.temperature[y][x + shift])>>0;
            type = (fmap.type[y][x + shift])>>0;
            if (temp <= 0 && type == 4) type=5; // Set to snow

            // Convert to Units after snow detemination
            if (!properties.settings.metric) temp = (temp * 9 /5 + 32).toFixed(0);

            ctx.fillStyle = '#383b79';
            //ctx.fillRect((x + shift) * 65 - 85, y * 65 - 52 , 160, 64 );
            ctx.drawImage(img_wx[type - 1], (x + shift) * 65 - 75, y * 65 - 52);

            // Add text with shadow
            ctx.fillStyle = '#000000'; // White
            ctx.fillText(temp + "\xb0", (x + shift) * 65 -2 , y * 65 -2 );
            ctx.fillStyle = '#ffffff'; // White
            ctx.fillText(temp + "\xb0", (x + shift) * 65 -4 , y * 65 -4 );
        }
    }
    ctx.stroke();
}

// Callback for CONREC to draw contour segment
var conrec_ctx;
var level = -1;
drawContours = function(x1,y1,x2,y2, l) {
    conrec_ctx.beginPath();
    conrec_ctx.moveTo(y1 * 65,x1 * 65);
    conrec_ctx.lineTo(y2 * 65,x2 * 65);
    conrec_ctx.stroke();

    if (!properties.settings.metric) l = (l * 0.0295301).toFixed(2);
    if (level != l) {
        conrec_ctx.fillStyle = '#000000';
        conrec_ctx.fillText(l, y1 * 65 + 5 +2, x1 * 65 +2);
        conrec_ctx.fillStyle = '#ffffff';
        conrec_ctx.fillText(l, y1 * 65 + 5, x1 * 65 );
        level = l;
    }
}

// Draw the ISOBARS using CONREC
function drawIsoBars(ctx) {
    // Add Guard
    if (fmap.pressure.length == 0) return;

    var data = fmap.pressure;
    var c = new Conrec();
    var ilb = 0;
    var iub = 58;
    var jlb = 0;
    var jub = 58;
    var x = [];
    var y = [];

    conrec_ctx = ctx;
    conrec_ctx.strokeStyle = '#383b79';
    //ctx.fillStyle = '#ff0000';
    conrec_ctx.lineWidth = 4;
    ctx.font = '18px serif';

    // Setup the data matrix column and row coordinates
    for (var i = ilb; i <= iub; i ++) {
        var coord = i;
        x.push(coord);
        y.push(coord);
    }

    // Setup the Pressure contour levels to draw
    var pressures = Array((fmap.analytics.pressure_max - fmap.analytics.pressure_min)>>0).fill(0);
    for (var i=0;i < pressures.length; i++) {
        pressures[i] = (fmap.analytics.pressure_min >> 0) + i;
    }

    // Create the Contour
    c.drawContour = drawContours;
    c.contour(fmap.pressure, ilb, iub, jlb, jub, x, y, pressures.length, pressures);
}

function clearLegend(ctx) {
    var coords = properties.legend.split(',');
    var height = coords[3] - coords[1];
    var width = coords[2] - coords[0];
    ctx.clearRect(coords[0],coords[1],width,height);
}
