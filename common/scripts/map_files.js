//
// FILE PROCESSING FOR BMS FILES
//
// This file will process Mission.ini  and Pilot.ini files.
// TODO: Process .fmap files for weather layer

var reader = new FileReader();
var filename = "";

function processWhiteboard(data) {
    var img = new Image(3840, 3840);

    layer.whitebrd.used = true;
    if (!properties.shifted) {
        layer.whitebrd.ctx.clearRect(0,0,layer.whitebrd.canvas.width,layer.whitebrd.canvas.height);
    }

    // Setup the image
    img.onload = function(){
        layer.whitebrd.ctx.drawImage(img, 0, 0);
        imcsMsgWhitebrdSend(layer.whitebrd.canvas);
        refreshCanvas();
    }
    img.src = data;
}

// Callback for file is loaded and available
// Check if this is the text .ini or the .fmap and call
// the appropriate handler.
// BMS fmap weather or Mission.ini and Pilot.ini can be dropped
function processFile(e) {

    if (typeof(reader.result) == "string") {

        // Process .ini file
        if (filename.endsWith(".ini")) {
            processDataCartridge(reader.result);
            refreshCanvas();
            return;
        }
        // Process .png file
        if (filename.endsWith(".png")) {
            processWhiteboard(reader.result);
            return;
        }
    }
    if (typeof(reader.result) == "object") {

        // Process .fmap file
        if (filename.endsWith(".fmap")) {
            processWeather(reader.result);
            refreshCanvas();
            return;
        }
        // Process GRIB2 file
        if (filename.startsWith("gfs.")) {
            ProcessGrib2(reader.result);
            refreshCanvas();
            return;
        }
    }
}

//
// GENERIC FILE DROP HANDLERS
//

// Disable Default behavior and allow dropped files to be handled
function allowDrop(ev) {
    ev.preventDefault();
}

// Handle Files Dropped on this window (.ini .fmap or .png)
// The .ini is for mission files
// The .fmap is for the weather data
// The .png is for restoring the Whiteboard
function dropHandler(ev) {

    ev.preventDefault();

    if (ev.dataTransfer.items) {

        // Use DataTransferItemList interface for Modern Browers
        for (let i = 0; i < ev.dataTransfer.items.length; i++) {

            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[i].kind === 'file') {
                const file = ev.dataTransfer.items[i].getAsFile();
                filename = file.name;
                if (filename.endsWith(".ini"))   reader.readAsText(file);
                if (filename.endsWith(".fmap"))  reader.readAsArrayBuffer(file);
                if (filename.endsWith(".png"))   reader.readAsDataURL(file);
                if (filename.startsWith("gfs.")) reader.readAsArrayBuffer(file);
            }
        }
    } else {
        // Detect DataTransfer interface for old browsers
        for (let i = 0; i < ev.dataTransfer.files.length; i++) {
        //console.log('-file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
        }
    }
}
