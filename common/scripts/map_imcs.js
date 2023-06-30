//
// Falcon BMS Interactive Map Collaboration Client
//

const IMCS_DEBUG = false;

// Message Documentation
// When sending these will be rebuild and you can use this
// for debugging
var imcs_msg = {
    auth: {
        id: 0, // Message ID
        callsign: "",
        session: "",
    },
    bullseye: {
        id: 1, // Message ID
        client: -1,
        x: -1, y: -1,
    },
    symbol: {
        id: 2, // Message ID
        client: -1,
        sidc: 0, x: -1, y: -1
    },
    line: {
        id: 3, // Message ID
        client: -1,
        style: style, x1: -1, y1: -1, x2: -1, y2: -1
    },
    ellipse: {
        id: 4, // Message ID
        client: -1,
        style: style, x1: -1, y1: -1, x2: -1, y2: -1
    },
    marker: {
        id: 5, // Message ID
        client: -1,
        style: style, x1: -1, y1: -1, x2: -1, y2: -1
    },
    text: {
        id: 6, // Message ID
        client: -1,
        text: "" , x: -1, y: -1
    },
    erase: {
        id: 7, // Message ID
        client: -1,
        dim: 0, x: -1, y: -1
    },
    whitebrd: {
        id: 8, // Message ID
        client: -1,
        data: []
    },
    pointer: {
        id: 9, // Message ID
        client: -1,
        on: false, x: -1, y: -1
    }
};

var imcs = {
    socket: null,
    session: "",
    callsign: "",
    client: -1
}

function imcsDebug(...args) {
    if (IMCS_DEBUG) args.forEach(arg => console.log(arg));
}

function imcsConnected() {
    return (imcs.client < 0)?false:true;
}
// Handle Connection Errors
var imcsConnectionError = function(err) {
    alert("Failed connection to Interactive Map Collaboration Server");
}

// Handle Authentication Response
function imcsMsgAuthRcvd(msg) {
    imcsDebug("Message: Auth");
    if (msg.result == -1) {
        console.log("Failed to register Callsign with Session");
        imcsDisconnect();
    }
    else {
        imcs.client = msg.result;
        layer.whitebrd.used = true;
        document.getElementById("imcs-connection").innerHTML = "Leave";
    }
}

// Receive and update Bullseye location
function imcsMsgBullseyeRcvd(msg) {
    imcsDebug("Message: Bullseye");
    bullseye.x = msg.x * properties.zoom;
    bullseye.y = msg.y * properties.zoom;
    refreshCanvas();
}

// Receive aSymbol Drwaing Request
function imcsMsgSymbolRcvd(msg) {
    imcsDebug("Message: Symbol");
    var entity = firstSymbol(msg.sidc);
    if (entity) {
        var img = new Image();

        img.onload = function(){ // Once the image is loaded draw it
            layer.whitebrd.ctx.drawImage(img, msg.x - 16, msg.y - 16);
            refreshCanvas();
        };
        img.setAttribute('crossorigin', 'anonymous');
        img.src = entity.icon;
    }
    refreshCanvas();
}

// Receive Line Drawing Request
function imcsMsgLineRcvd(msg) {
    imcsDebug("Message: Line");
    drawLine(layer.whitebrd.ctx, msg.style, {x: msg.x1, y: msg.y1},{x: msg.x2, y: msg.y2});
    refreshCanvas();
}

// Receive Ellipse Drawing Request
function imcsMsgEllipseRcvd(msg) {
    imcsDebug("Message: Ellipse");
    drawEllipse(layer.whitebrd.ctx, msg.style, {x: msg.x1, y: msg.y1},{x: msg.x2, y: msg.y2});
    refreshCanvas();
}

// Receive Ellipse Drawing Request
function imcsMsgMarkerRcvd(msg) {
    imcsDebug("Message: Marker");
    drawMarker(layer.whitebrd.ctx, msg.style, {x: msg.x1, y: msg.y1},{x: msg.x2, y: msg.y2});
    refreshCanvas();
}

// Receive Text Drawing Request
function imcsMsgTextRcvd(msg) {
    imcsDebug("Message: Text");
    drawText(layer.whitebrd.ctx,msg.text, msg.x, msg.y);
    refreshCanvas();
}

// Receive Erase Drawing Request
function imcsMsgEraseRcvd(msg) {
    imcsDebug("Message: Erase");
    eraseMarker(layer.whitebrd.ctx,msg.x,msg.y, msg.dim);
    refreshCanvas();
}

// Receive Erase Drawing Request
function imcsMsgWhitebrdRcvd(msg) {
    imcsDebug("Message: Whiteboard: " + msg.data.length);
    var img = new Image(3840,3840);
    img.src = msg.data;
    img.onload = () => {
        layer.whitebrd.ctx.clearRect(0,0,3840,3840);
        layer.whitebrd.ctx.drawImage(img,0,0,3840,3840);
        refreshCanvas();
    };
}

// Receive Pointer Request
function imcsMsgPointerRcvd(msg) {
    imcsDebug("Message: Pointer");
    drawPointer(context, msg.on, {x: msg.x * properties.zoom, y: msg.y * properties.zoom});
}

// Handle Messages from IMCS
var imcsMsgReceive = function(e) {
    var msg = JSON.parse(e.data);

    if (e.data instanceof Blob) {
        imcsDebug("Received Whiteboard");
    }

    switch(msg.id) {
        case 0: imcsMsgAuthRcvd(msg);
            break;
        case 1: imcsMsgBullseyeRcvd(msg);
            break;
        case 2: imcsMsgSymbolRcvd(msg);
            break;
        case 3: imcsMsgLineRcvd(msg);
            break;
        case 4: imcsMsgEllipseRcvd(msg);
            break;
        case 5: imcsMsgMarkerRcvd(msg);
            break;
        case 6: imcsMsgTextRcvd(msg);
            break;
        case 7: imcsMsgEraseRcvd(msg);
            break;
        case 8: imcsMsgWhitebrdRcvd(msg);
            break;
        case 9: imcsMsgPointerRcvd(msg);
            break;
    }
}

// Send Pointer message
function imcsMsgPointerSend(state,x, y) {
    if (imcs.client < 0 ) return;
    imcs_msg.pointer = { id: 9, client: imcs.client, on: state, x: x, y: y };
    imcs.socket.send(JSON.stringify(imcs_msg.pointer));
}

// Send Whiteboard message
function imcsMsgWhitebrdSend(canvas) {
    if (imcs.client < 0 ) return;
    var data = canvas.toDataURL('image/png');
    imcs_msg.whitebrd = {id: 8, client: imcs.client, data: data};
    imcs.socket.send(JSON.stringify(imcs_msg.whitebrd));
}

// Send Erase message
function imcsMsgEraseSend(dim,x, y) {
    if (imcs.client < 0 ) return;
    imcs_msg.erase = { id: 7, client: imcs.client, dim: dim, x: x, y: y };
    imcs.socket.send(JSON.stringify(imcs_msg.erase));
}

// Send Text message
function imcsMsgTextSend(text,x, y) {
    if (imcs.client < 0 ) return;
    imcs_msg.text = { id: 6, client: imcs.client, text: text, x: x,y: y };
    imcs.socket.send(JSON.stringify(imcs_msg.text));
}

// Send Marker message
function imcsMsgMarkerSend(style,x1, y1, x2, y2) {
    if (imcs.client < 0 ) return;
    imcs_msg.ellipse = { id: 5, client: imcs.client, style: style,
                      x1: x1, y1: y1, x2: x2, y2: y2 };
    imcs.socket.send(JSON.stringify(imcs_msg.ellipse));
}

// Send Ellipse message
function imcsMsgEllipseSend(style,x1, y1, x2, y2) {
    if (imcs.client < 0 ) return;
    imcs_msg.ellipse = { id: 4, client: imcs.client, style: style,
                      x1: x1, y1: y1, x2: x2, y2: y2 };
    imcs.socket.send(JSON.stringify(imcs_msg.ellipse));
}

// Send line message
function imcsMsgLineSend(style,x1, y1, x2, y2) {
    if (imcs.client < 0 ) return;
    imcs_msg.line = { id: 3, client: imcs.client, style: style,
                      x1: x1, y1: y1, x2: x2, y2: y2 };
    imcs.socket.send(JSON.stringify(imcs_msg.line));
}

// Send Symbol and location
function imcsMsgSymbolSend(sidc, x, y) {
    if (imcs.client < 0 ) return;
    imcs_msg.symbol = { id: 2, client: imcs.client, sidc: sidc, x: x, y: y, };
    imcs.socket.send(JSON.stringify(imcs_msg.symbol));
}

// Send Bullseye location
function imcsMsgBullseyeSend(x, y) {
    if (imcs.client < 0 ) return;
    imcs_msg.bullseye = { id: 1, client: imcs.client, x: x, y: y};
    imcs.socket.send(JSON.stringify(imcs_msg.bullseye));
}

// Send Authentication Response
function imcsMsgAuthSend() {
    imcs_msg.auth = {id: 0, session: imcs.session, callsign: imcs.callsign};
    imcs.socket.send(JSON.stringify(imcs_msg.auth));
}

// Once connected send the credentials
var imcsConnection = function() {
    imcsMsgAuthSend();
}

// Without current Connectio, connect to the IMCS
// otherwise disconnect from the IMCS
function imcsConnect(callsign, session, url) {
    imcs.socket = new WebSocket(url);
    imcs.socket.addEventListener("open",   imcsConnection );
    imcs.socket.addEventListener("error",  imcsConnectionError );
    imcs.socket.addEventListener("message",imcsMsgReceive , MessageEvent );
    imcs.callsign = callsign;
    imcs.session = session;
}

// Close the connection with the IMCS
function imcsDisconnect() {
    imcs.socket.close();
    imcs.client = -1;
    document.getElementById("imcs-connection").innerHTML = "Join";
}
