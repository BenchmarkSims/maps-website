//
// Javascript for BMS Interactive Maps GFS access
//
// Decoding per: https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/
// Regulations: https://codes.ecmwf.int/grib/format/grib2/regulations/
//
// Regulations document the bit encoding / decoding
//

const GFS_DEBUG = false;

const gfs_grib_0p25 = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?';
const gfs_levels = "&lev_100_mb=on&lev_150_mb=on&lev_200_mb=on&lev_300_mb=on&lev_400_mb=on&lev_500_mb=on&lev_650_mb=on&lev_700_mb=on&lev_850_mb=on&lev_925_mb=on&lev_2_m_above_ground=on&lev_10_m_above_ground=on&lev_convective_cloud_layer=on&lev_high_cloud_layer=on&lev_low_cloud_layer=on&lev_mean_sea_level=on&lev_middle_cloud_layer=on&lev_surface=on&lev_convective_cloud_bottom_level=on&lev_convective_cloud_top_level=on&lev_high_cloud_bottom_level=on&lev_high_cloud_top_level=on&lev_low_cloud_bottom_level=on&lev_low_cloud_top_level=on&lev_middle_cloud_bottom_level=on&lev_middle_cloud_top_level=on";
const gfs_params = "&var_ACPCP=on&var_APCP=on&var_PRATE=on&var_PRMSL=on&var_TCDC=on&var_TMP=on&var_UGRD=on&var_VGRD=on&var_VIS=on&var_PRES=on";

// Message enumeration
// This is param category and param num combined from Message section 4
const gfsMsgType = {
    TMP:     0, PRATE: 263, APCP:  264, ACPCP: 266, UGRD:  514, VGRD:  515,
    PRES:  768, PRMSL: 769, TCDC: 1537, VIS:  4864, UNKN:   -1,
};



// GFS File Structure
var gfs_file = {
    offset: 0,
    bytes: [],
    msg_cnt: 0,
};

var gfs_msg = {
    s0: {
        name: 'Indicator', section: 0, offset: 0,
        grib: [],
        discipline: 0,
        edition: 0,
        size: 0 },
    s1: {
        name: 'Identification', offset: 16, size: 0, section: 1,
        center: 0, subcenter: 0,
        mastr_tbl_ver: 0, local_tbl_ver: 0,
        time_ref: 0,
        year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0,
        status: 0,
        type: 0,
    },
    s2: {
        name: 'Local Use', offset: 0, size: 0, section: 2,
        local: []
    },
    s3: {
        name: 'Gird Definition', offset: 0, size: 0, section: 3,
        gird_source: 0,
        num_points: 0,
        list_num: 0,
        num_octets: 0,
        list_num: 0,
        template: 0,
        def: {},
    },
    s4: {
        name: 'Product Definition', offset: 0, size: 0, section: 4,
        num_coords: 0,
        template: 0,
        def: {},
    },
    s5: {
        name: 'Data Representation', offset: 0, size: 0, section: 5,
        num_points: 0,
        template: 0,
        def: {},
    },
    s6: {
        name: 'Bitmap', offset: 0, size: 0, section: 6,
        indicator: 0, bitmap: [],
    },
    s7: {
        name: 'Data', offset: 0, size: 0, section: 6, data: [],
    },
    s8: {
        name: 'End', offset: 0, size: 4, tag: "",
    },
};

// GFS Message Buffers and Transcoding scaling and offset
var gfs = {
    prmsl: { name: 'PRMSL', offset:    0.00, scale: 0.01,  level: -1, data: []},
    vis:   { name: 'VIS',   offset:    0.00, scale: 0.001, level: -1, data: []},
    tmp:   { name: 'TMP',   offset: -273.15, scale: 1.00,  level: -1, data: []},
    tcdc:  { name: 'TCDC',  offset:    0.00, scale: 0.125, level: -1, data: []},
    ugrd:  { name: 'UGRD',  offset:    0.00, scale: 1.944, level: -1, data: []},
    vgrd:  { name: 'VGRD',  offset:    0.00, scale: 1.944, level: -1, data: []},
    pres:  { name: 'VGRD',  offset:    0.00, scale: 0.01,  level: -1, data: []},
    prate: { name: 'VGRD',  offset:    0.00, scale: 3600,  level: -1, data: []},
    apcp:  { name: 'VGRD',  level: -1, data: []},
    acpcp: { name: 'VGRD',  level: -1, data: []},
}

function gfsDebug(...args) {
    if (GFS_DEBUG) args.forEach(arg => console.log(arg))
}

// Get Products without query
// Just estimate the update time based on NOAA schedule
// No need to query (They prefer this)
function gfsGetAvailableProd() {
    var date = new Date();
    var prod = [];

    date.setUTCDate(date.getUTCDate() - 1);

    // Get the values for Year, Month and Day
    // Only go back 7 previous days GFS supports 10
    for (var i = 0; i < 7; i++) {
        // Get Values
        var year  = date.getUTCFullYear();
        var month = date.getUTCMonth();
        var day   = date.getUTCDate();

        // Make String version
        var day_str = day.toString();
        var month_str = (month+1).toString();
        var year_str = year.toString();

        // Add padding
        day_str   = (day_str.length == 1)?"0"+day_str:day_str;
        month_str = (month_str.length == 1)?"0"+month_str:month_str;
        year_str  = (year_str.length == 1)?"0"+year_str:year_str;

        // Create Prod String
        var date_str = year_str + month_str + day_str;
        prod.push(date_str);
        date.setUTCDate(date.getUTCDate()-1);
    }
    return prod;
}

// Construct name like: gfs.t18z.pgrb2.0p25.f001
function gfsGetFilename(cycle,offset) {
    var forecast_str = offset.toString();
    while (forecast_str.length < 3) forecast_str = "0" + forecast_str;
    return "gfs.t" + cycle + "z.pgrb2.0p25.f" + forecast_str;
}

// Construct name like: %2Fgfs.20230531%2F18%2Fatmos
function gfsGetDirname(date,cycle) {
    return "%2Fgfs." + date + "%2F" + cycle + "%2Fatmos";
}

// Set the bounding box for the region
function gfsGetTheaterBox(datum) {
    var b_lat = Math.round(parseFloat(datum.lat));
    var t_lat = b_lat + 9.0;
    var l_long = Math.round(parseFloat(datum.long));
    var r_long = l_long + 9.0;
    return {top: t_lat, left: l_long, right: r_long, bottom: b_lat };
}
// Construct theater region: &toplat=90&leftlon=0&rightlon=360&bottomlat=-90
// So provide left and righg longitude and top and bottom latitude
function gfsGetTheaterSubRegion(datum) {
    var box = gfsGetTheaterBox(datum);
    return "&toplat=" + box.top + "&leftlon=" + box.left + "&rightlon=" + box.right + "&bottomlat=" + box.bottom;
}

function gfsConstructURL(datum, date,cycle,offset) {
    var filename  = gfsGetFilename(cycle,offset);
    var dirname   = gfsGetDirname(date,cycle);
    var subregion = gfsGetTheaterSubRegion(datum);
    var grib_filter = "dir=" + dirname + "&file=" + filename + gfs_params + gfs_levels + "&subregion=" + subregion;
    return gfs_grib_0p25 + grib_filter;
}

// Experimental Should Work but on on GFS due to CORS blocked
function gfsFetchForecast(url) {
    fetch(url, {
        method: 'GET',
        headers: {}
        }).then( response => response.blob() ).then( blob => console.log(blob) )
}

function gfsSwapBytes(byte_array, s, d){
    var tmp = byte_array[s];
    byte_array[s] = byte_array[d];
    byte_array[d] = tmp;
}

// Adapt to Compute Platform
function gfsEndianness(byte_array){
    // Check Endianness
    let uInt32 = new Uint32Array([0x11223344]);
    let uInt8 = new Uint8Array(uInt32.buffer);
    if(uInt8[0] === 0x11) return byte_array;

    // On LE Swap Bytes since GFS is BE
    var len = byte_array.length;
    switch (len) {
        case 2:
            gfsSwapBytes(byte_array,0,1);
            break;
        case 4:
            gfsSwapBytes(byte_array,0,3);
            gfsSwapBytes(byte_array,1,2);
            break;
        case 8:
            gfsSwapBytes(byte_array,0,7);
            gfsSwapBytes(byte_array,1,6);
            gfsSwapBytes(byte_array,2,5);
            gfsSwapBytes(byte_array,3,4);
        default:
            break;
    }
    return byte_array;
}

// Convert Array to String
function gfsArray2Str(byte_array) {
    var result = "";
    for (var i = 0; i < byte_array.length; i++) {
      result += String.fromCharCode(byte_array[i]);
    }
    return result;
  }

// Convert Array to Integer
function gfsArrayToInt(byte_array) {
    var value = 0;
    for ( var i = byte_array.length - 1; i >= 0; i--) {
        value = (value * 256) + byte_array[i];
    }
    return value;
};

// Bit unpack for 9 to 16 bits
// Array a, bits bs and index i
function gfsBitUnpack(a, bs, i) {
    var mb = (1 << bs) - 1; // mask
    var sb = i * bs;        // Start bit
    var eb = sb + bs;       // End bit
    var ms = 8 - (eb % 8);  // Shift to mask area
    var sy = (sb / 8) >> 0; // Start Byte
    var ey = (eb / 8) >> 0; // End Byte
    var res = 0;

    for (var i=sy; i <= ey; i++) res = res * 256 + a[i];
    res = (res >> ms) & mb;

    return res;
}

// Get Octet
function gfsSectionOctet(start,end) {
    return gfs_file.bytes.slice(gfs_file.offset + start-1, gfs_file.offset + end);
}

function gfsSectionInt(start,end) {
    return gfsArrayToInt(gfsEndianness(gfsSectionOctet(start, end)));
}

function gfsSectionFloat32(s,e) {
    var buf   = new Uint8Array(gfsSectionOctet(s, e)).buffer;
    var value = new DataView(buf);
    return value.getFloat32(0);
}

function gfsMsgReadSection0() {
    gfs_msg.s0.offset     = gfs_file.offset;
    gfs_msg.s0.grib       = gfsArray2Str(gfsSectionOctet(1,4));
    if (gfs_msg.s0.grib === 'GRIB') {
        gfs_msg.s0.discipline = gfsSectionInt(7,7);
        gfs_msg.s0.edition    = gfsSectionInt(8,8);
        gfs_msg.s0.size       = gfsSectionInt(9,16);
        gfs_file.offset        += 16;
        gfsDebug(gfs_msg.s0);
    }
}

function gfsMsgReadSection1() {
    gfs_msg.s1.offset  = gfs_file.offset;
    gfs_msg.s1.size    = 0;
    gfs_msg.s1.section = gfsArrayToInt(gfsSectionOctet(5, 5));
    if (gfs_msg.s1.section == 1 ) {
        gfs_msg.s1.offset        = gfs_file.offset;
        gfs_msg.s1.size          = gfsSectionInt(1, 4);
        gfs_msg.s1.center        = gfsSectionInt(6, 7);
        gfs_msg.s1.subcenter     = gfsSectionInt(8, 9);
        gfs_msg.s1.mastr_tbl_ver = gfsSectionInt(10, 10);
        gfs_msg.s1.local_tbl_ver = gfsSectionInt(11, 11);
        gfs_msg.s1.time_ref      = gfsSectionInt(12, 12);
        gfs_msg.s1.year          = gfsSectionInt(13, 14);
        gfs_msg.s1.month         = gfsSectionInt(15, 15);
        gfs_msg.s1.day           = gfsSectionInt(16, 16);
        gfs_msg.s1.hour          = gfsSectionInt(17, 17);
        gfs_msg.s1.minute        = gfsSectionInt(18, 18);
        gfs_msg.s1.second        = gfsSectionInt(19, 19);
        gfs_msg.s1.status        = gfsSectionInt(20, 20);
        gfs_msg.s1.type          = gfsSectionInt(21, 21);
        gfs_file.offset          += gfs_msg.s1.size;

        //if (gfs_msg.s1.size != 21) alert("TODO: 22-N Reserved");
        gfsDebug(gfs_msg.s1);
    }
}

function gfsMsgReadSection2() {
    gfs_msg.s2.offset  = gfs_file.offset;
    gfs_msg.s2.size = 0;
    gfs_msg.s2.section    = gfsSectionInt(5, 5);
    if (gfs_msg.s2.section == 2 ) {
        gfs_msg.s2.offset     = gfs_file.offset;
        gfs_msg.s2.size       = gfsSectionInt(1, 4);
        gfs_file.offset       += gfs_msg.s2.size;
        gfsDebug(gfs_msg.s2);
    }
}

function gfsGridDefTemplate3_0() {
    gfs_msg.s3.def.name = 'Latitude/Longitude';
    gfs_msg.s3.def.earth_shape = gfsSectionInt(15, 15);
    gfs_msg.s3.def.scale_factor_radius = gfsSectionInt(16, 16);
    gfs_msg.s3.def.scaled_value_radius = gfsSectionInt(17, 20);
    gfs_msg.s3.def.scale_factor_majorx = gfsSectionInt(21, 21);
    gfs_msg.s3.def.scaled_value_majorx = gfsSectionInt(22, 25);
    gfs_msg.s3.def.scale_factor_minorx = gfsSectionInt(26, 26);
    gfs_msg.s3.def.scaled_value_minorx = gfsSectionInt(27, 30);
    gfs_msg.s3.def.Ni = gfsSectionInt(31, 34);
    gfs_msg.s3.def.Nj = gfsSectionInt(35, 38);
    gfs_msg.s3.def.basic_angle = gfsSectionInt(39, 42);
    gfs_msg.s3.def.basic_angle_subdiv = gfsSectionInt(43, 46);
    gfs_msg.s3.def.lat1 = gfsSectionInt(47, 50);
    gfs_msg.s3.def.long1 = gfsSectionInt(51, 54);
    gfs_msg.s3.def.res_flags = gfsSectionInt(55, 55);
    gfs_msg.s3.def.lat2 = gfsSectionInt(56, 59);
    gfs_msg.s3.def.long2 = gfsSectionInt(60, 63);
    gfs_msg.s3.def.Di = gfsSectionInt(64, 67);
    gfs_msg.s3.def.Dj = gfsSectionInt(68, 71);
    gfs_msg.s3.def.scan_flags = gfsSectionInt(72, 72);
}

function gfsMsgReadSection3() {
    gfs_msg.s3.offset  = gfs_file.offset;
    gfs_msg.s3.size = 0;
    gfs_msg.s3.section    = gfsSectionInt(5, 5);
    if (gfs_msg.s2.section == 3 ) {
        gfs_msg.s3.size         = gfsSectionInt(1, 4);
        gfs_msg.s3.grid_source  = gfsSectionInt(6, 6);
        gfs_msg.s3.num_points   = gfsSectionInt(7, 10);
        gfs_msg.s3.num_octets   = gfsSectionInt(11, 11);
        gfs_msg.s3.list_num     = gfsSectionInt(12, 12);
        gfs_msg.s3.template     = gfsSectionInt(13, 14);

        // Pick template definition
        switch (gfs_msg.s3.template) {
            case 0:
                gfsGridDefTemplate3_0();
                break;
            default:
                console.log("Missing Grid Template");
                break;
        }
        gfs_file.offset         += gfs_msg.s3.size;
        gfsDebug(gfs_msg.s3);
    }
}

function gfsProdDefTemplate4_0() {
    gfs_msg.s4.def.name = 'Analysis or forecast at a horizontal level';
    gfs_msg.s4.def.param_cat       = gfsSectionInt(10, 10);
    gfs_msg.s4.def.param_num       = gfsSectionInt(11, 11);
    gfs_msg.s4.def.process_type    = gfsSectionInt(12, 12);
    gfs_msg.s4.def.process_bgnd    = gfsSectionInt(13, 13);
    gfs_msg.s4.def.process_model   = gfsSectionInt(14, 14);
    gfs_msg.s4.def.data_hrs        = gfsSectionInt(15, 16);
    gfs_msg.s4.def.data_min        = gfsSectionInt(17, 17);
    gfs_msg.s4.def.time_unit       = gfsSectionInt(18, 18);
    gfs_msg.s4.def.time_forecast   = gfsSectionInt(19, 22);
    gfs_msg.s4.def.surface1_type   = gfsSectionInt(23, 23);
    gfs_msg.s4.def.surface1_factor = gfsSectionInt(24, 24);
    gfs_msg.s4.def.surface1_value  = gfsSectionInt(25, 28);
    gfs_msg.s4.def.surface2_type   = gfsSectionInt(29, 29);
    gfs_msg.s4.def.surface2_factor = gfsSectionInt(30, 30);
    gfs_msg.s4.def.surface2_value  = gfsSectionInt(31, 34);
}

function gfsProdDefTemplate4_8() {
    gfs_msg.s4.def.name = 'Avg, Accumulation, Extreme or Statistically-processed values';
    gfs_msg.s4.def.param_cat         = gfsSectionInt(10, 10);
    gfs_msg.s4.def.param_num         = gfsSectionInt(11, 11);
    gfs_msg.s4.def.process_type      = gfsSectionInt(12, 12);
    gfs_msg.s4.def.process_bgnd      = gfsSectionInt(13, 13);
    gfs_msg.s4.def.process_model     = gfsSectionInt(14, 14);
    gfs_msg.s4.def.data_hrs          = gfsSectionInt(15, 16);
    gfs_msg.s4.def.data_min          = gfsSectionInt(17, 17);
    gfs_msg.s4.def.time_unit         = gfsSectionInt(18, 18);
    gfs_msg.s4.def.time_forecast     = gfsSectionInt(19, 22);
    gfs_msg.s4.def.surface1_type     = gfsSectionInt(23, 23);
    gfs_msg.s4.def.surface1_factor   = gfsSectionInt(24, 24);
    gfs_msg.s4.def.surface1_value    = gfsSectionInt(25, 28);
    gfs_msg.s4.def.surface2_type     = gfsSectionInt(29, 29);
    gfs_msg.s4.def.surface2_factor   = gfsSectionInt(30, 30);
    gfs_msg.s4.def.surface2_value    = gfsSectionInt(31, 34);
    gfs_msg.s4.def.end_year          = gfsSectionInt(35, 36);
    gfs_msg.s4.def.end_month         = gfsSectionInt(37, 37);
    gfs_msg.s4.def.end_day           = gfsSectionInt(38, 38);
    gfs_msg.s4.def.end_hour          = gfsSectionInt(39, 39);
    gfs_msg.s4.def.end_minute        = gfsSectionInt(40, 40);
    gfs_msg.s4.def.end_second        = gfsSectionInt(41, 41);
    gfs_msg.s4.def.num_intervals     = gfsSectionInt(42, 42);
    gfs_msg.s4.def.num_missing_data  = gfsSectionInt(43, 46);
    // Need to add dynamic range specs based on num_intervals: n
    // The block below would repeat for each interval spec.
}

function gfsMsgReadSection4() {
    gfs_msg.s4.offset  = gfs_file.offset;
    gfs_msg.s4.size = 0;
    gfs_msg.s4.section    = gfsSectionInt(5, 5);
    if (gfs_msg.s4.section == 4 ) {
        gfs_msg.s4.offset     = gfs_file.offset;
        gfs_msg.s4.size       = gfsSectionInt(1, 4);
        gfs_msg.s4.num_coords = gfsSectionInt(6, 7);
        gfs_msg.s4.template   = gfsSectionInt(8, 9);

        // Since 2 templates are handled best to clear the previous
        for (var member in gfs_msg.s4.def) delete gfs_msg.s4.def[member];

        // Pick template definition
        switch (gfs_msg.s4.template) {
            case 0:
                gfsProdDefTemplate4_0();
                break;
            case 8:
                gfsProdDefTemplate4_8();
                break;
            default:
                console.log("#" + gfs_file.msg_cnt + " Missing Product Template: ", gfs_msg.s4.template );
                break;
        }
        gfs_file.offset       += gfs_msg.s4.size;
        gfsDebug(gfs_msg.s4);
    }
}

function gfsDataDefTemplate5_0() {
    gfs_msg.s5.def.name = 'Grid point data - simple packing';
    gfs_msg.s5.def.ref_value = gfsSectionFloat32(12,15);
    gfs_msg.s5.def.bin_scale = gfsSectionInt(16, 17);
    gfs_msg.s5.def.dec_scale = gfsSectionInt(18, 19);
    gfs_msg.s5.def.bits      = gfsSectionInt(20, 20);
    gfs_msg.s5.def.type      = gfsSectionInt(21, 21);
}

function gfsMsgReadSection5() {
    gfs_msg.s5.offset  = gfs_file.offset;
    gfs_msg.s5.size    = 0;
    gfs_msg.s5.section = gfsSectionInt(5, 5);
    if (gfs_msg.s5.section == 5 ) {
        gfs_msg.s5.offset     = gfs_file.offset;
        gfs_msg.s5.size       = gfsSectionInt( 1,  4);
        gfs_msg.s5.num_points = gfsSectionInt( 6,  9);
        gfs_msg.s5.template   = gfsSectionInt(10, 11);

        // Pick template definition
        switch (gfs_msg.s5.template) {
            case 0:
                gfsDataDefTemplate5_0();
                break;
            default:
                console.log("#" + gfs_file.msg_cnt + "Missing Data Template", gfs_msg.s5.template);
                break;
        }
        gfs_file.offset       += gfs_msg.s5.size;
        gfsDebug(gfs_msg.s5);
    }
}

function gfsMsgReadSection6() {
    gfs_msg.s6.offset  = gfs_file.offset;
    gfs_msg.s6.size    = 0;
    gfs_msg.s6.section = gfsSectionInt(5, 5);
    if (gfs_msg.s6.section == 6 ) {
        gfs_msg.s6.offset     = gfs_file.offset;
        gfs_msg.s6.size       = gfsSectionInt( 1,  4);
        gfs_msg.s6.indicator  = gfsSectionInt( 6,  6);
        if (gfs_msg.s6.indicator == 0) {
            gfs_msg.s6.bitmap = gfsSectionOctet( 7,  gfs_msg.s6.size);
        }
        gfs_file.offset       += gfs_msg.s6.size;
        gfsDebug(gfs_msg.s6);
    }
}

function gfsMsgReadSection7() {
    gfs_msg.s7.offset  = gfs_file.offset;
    gfs_msg.s7.size    = 0;
    gfs_msg.s7.section = gfsSectionInt(5, 5);
    if (gfs_msg.s7.section == 7 ) {
        gfs_msg.s7.offset     = gfs_file.offset;
        gfs_msg.s7.size       = gfsSectionInt( 1,  4);
        gfs_msg.s7.data       = gfsSectionOctet( 6,  gfs_msg.s7.size);
        gfs_file.offset       += gfs_msg.s7.size;
        gfsDebug(gfs_msg.s7);
    }
}

function gfsMsgReadSection8() {
    gfs_msg.s8.offset  = gfs_file.offset;
    gfs_msg.s8.size    = 0;
    gfs_msg.s8.tag = gfsArray2Str(gfsSectionOctet(1,4));
    if (gfs_msg.s8.tag === '7777' ) {
        gfs_msg.s8.size    = 4;
        gfs_file.offset    += gfs_msg.s8.size;
        gfsDebug(gfs_msg.s8);
    }
}

function gfsReadGrib2Msg() {
    // Read Message Sections
    gfsMsgReadSection0();
    gfsMsgReadSection1();
    gfsMsgReadSection2();
    gfsMsgReadSection3();
    gfsMsgReadSection4();
    gfsMsgReadSection5();
    gfsMsgReadSection6();
    gfsMsgReadSection7();
    gfsMsgReadSection8();
}

// Regulation 92.9.4: Y * 10^D= R + (X1+X2) * 2^E
function gfsDecodeSimplePacking(index) {
    // Get bits from byte array
    var value = gfsBitUnpack(gfs_msg.s7.data,gfs_msg.s5.def.bits,index);

    // Decode value
    var bin_scale = (1 << gfs_msg.s5.def.bin_scale);
    var dec_scale = 10 ** gfs_msg.s5.def.dec_scale;
    var res       = (gfs_msg.s5.def.ref_value + value * bin_scale)/dec_scale;

    //console.log("Unpack param: ", gfs_msg.s5.def.bits, gfs_msg.s5.def.bin_scale, gfs_msg.s5.def.dec_scale );

    return res;
}

// Upscale BMS fmap data since the GFS is 0.25 degrees per step
function fmapUpscaleData(data) {
    // Upscaling Y pressures
    for (var y=0;y < fmap.dimension.y-1; y++) {
        for (var x=0;x < fmap.dimension.x-1; x++) {
            if ((x > 0) && (x % 2) > 0) data[y][x] = (data[y][x - 1] + data[y][x + 1])/2;
            if ((y > 0) && (y % 2) > 0) data[y][x] = (data[y-1][x] + data[y+1][x])/2;
        }
    }
}

// Decode to Memory temporary Buffer
function gfsDecodeMsg(name, buf) {

    buf.name = name;
    buf.level = gfs_msg.s4.def.surface1_value;
    buf.data = Array(gfs_msg.s3.num_points);
    for (var i=0;i<gfs_msg.s3.num_points;i++) buf.data[i] = gfsDecodeSimplePacking(i);
}

function gfsTranscodeMsg(name, src, dest ) {
    if (src.name != name ) return;
    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;
            data[x] = src.data[i] * src.scale + src.offset;

            // Exceptions should do something different but is fast
            if (dest === fmap.pressure) {
                if (data[x] < fmap.analytics.pressure_min) fmap.analytics.pressure_min = data[x];
                if (data[x] > fmap.analytics.pressure_max) fmap.analytics.pressure_max = data[x];
            }
            if (fmap.temperature) {
                if (data[x] < fmap.analytics.temperature_min) fmap.analytics.temperature_min = data[x];
                if (data[x] > fmap.analytics.temperature_max) fmap.analytics.temperature_max = data[x];
            }
        }
        dest.push(data);
    }
    fmapUpscaleData(dest);
}

// Standard pressures for 0 to 20000 ft
const gfsPressureLUT = [
    1013, 977, 942, 908, 875, 843, 812, 782, 753, 724, 697,
          670, 644, 619, 595, 572, 549, 527, 506, 485, 466
];

// Standard Temp for 0 to 20000 ft
const gfsTemperatureLUT = [
    15.0, 13.0, 11.0, 9.1, 7.1, 5.1, 3.1, 1.1, -0.8, -2.8, -4.8,
    -6.8, -8.8, - 10.8, -12.7, -14.7, -16.7, -18.7, -20.7, -22.6, -24.6
];

// Get Temperature at standard Pressure provide hPa and returns temp in C
function gfsPres2Temp(pressure) {
    var temp = -26.0;
    for (var i = 0; i < gfsPressureLUT.length; i++ ) {
        if (pressure => gfsPressureLUT[i]) {
            temp = gfsTemperatureLUT[i];
            break;
        }
    }
    return temp;
}

// Pressure Altitudes close to the BMS altitude wind layers
// in Pa
const gfsPressureAltitide = [10,92500,85000,70000,65000,50000,40000,30000,20000,10000];
function gfsGetPressureAltIndex(mb) {
    for (var i=0; i < gfsPressureAltitide.length;i++) {
        if (mb == gfsPressureAltitide[i]) break;
    }
    return i;
}

// DIRECTION=57.29578*(arctangent(UGRD,VGRD))+180.
// SPEED=SQRT(UGRD*UGRD+VGRD*VGRD)
// Where:
//  - UGRD is the North/South wind component (North is + & South is -) and
//  - VGRD is the East/West wind component (East is + West is - [I think...]).
function gfsTranscodeWinds() {
    var alt = gfsGetPressureAltIndex(gfs_msg.s4.def.surface1_value);
    if (alt == -1) return;

    // Guard against mixing data
    if (gfs.ugrd.level != gfs.vgrd.level) return;

    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {
            // Calculate the sampling index
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;

            // Get the wind components
            var ugrd = gfs.ugrd.data[i] * gfs.ugrd.scale;
            var vgrd = gfs.vgrd.data[i] * gfs.vgrd.scale;

            // Calculate direction and speed
            var direction = 57.29578*(Math.atan2(ugrd,vgrd))+180;
            var speed = Math.sqrt(ugrd*ugrd + vgrd*vgrd);
            fmap.wind[y][x][alt] = {direction: direction, speed: speed};
        }
    }
}

function gfsTranscodeCloudCoverage() {

    // Check only levels of largers than 20000 Pa
    if (gfs.tcdc.level < 20000) return;

    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {

            // Calculate the sampling index
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;

            // Determine Cloud Coverage
            var coverage = Math.round(gfs.tcdc.data[i] * gfs.tcdc.scale); // In percentage
            if (coverage >= fmap.cloud.cover[y][x]) fmap.cloud.cover[y][x] = coverage;

            // Determine Cloud Size
            if (coverage > 6) {
                if (fmap.cloud.size[y][x] > 1) fmap.cloud.size[y][x]--;
            }
            // Determine Cloud Type
            if (fmap.cloud.size[y][x] == 1) fmap.cloud.type[y][x] = 1; // TCu
        }
    }
}

function gfsTranscodeShowers() {
    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {

            // Calculate the sampling index
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;

            // Determine Shower Flag
            var prate  = gfs.prate.data[i] * gfs.prate.scale; // In mm/h after scaling
            if (prate >= 1.9) {
                fmap.shower[y][x] = 1;
            }
        }
    }
}

// prmsl, press in Pa
function gfsAltFromPRES(prmsl, pres, surf_temp) {
    // Physics Constants
    const R = 8.31432;   // Gas constant (N x m) / (mol x K)
    const M = 0.0289644; // kg/mol
    const g = 9.80665;   //  m/s^2
    const st = 15.0      // Standard Temp C.

    // Lookup Temperature from standard atmosphere
    var T = gfsPres2Temp(pres / 100)+273.15; // Kelvin
    T = T + (15 - surf_temp);

    // Determine Cloud Base
    // pres = prmsl e ^(-gMh / RT)
    // h = ln(P/P0) RT / -gM
    var alt = (Math.log(pres/prmsl)*R*T)/(-g*M);
    alt *= 3.28084; // Make ft

    return alt;
}

function gfsTranscodeCloudBase() {
    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    // Only process CLow Convective Clouds
    // Above 9800 ft consider CLR
    if (gfs_msg.s4.def.surface1_type != 242) return;

    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {

            // Calculate the sampling index
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;

            fmap.cloud.base[y][x] = gfsAltFromPRES(fmap.pressure[y][x] * 100, gfs.pres.data[i],fmap.temperature[y][x]);
        }
    }
}

function gfsTranscodeFogAltitude() {
    var scale_y = gfs_msg.s3.def.Nj / fmap.dimension.y;
    var scale_x = gfs_msg.s3.def.Ni / fmap.dimension.x;

    // Only process low cloud bottom layer
    if (gfs_msg.s4.def.surface1_type != 212) return;

    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {

            // Calculate the sampling index
            var gy = ((fmap.dimension.y - 1 - y) * scale_y) >> 0;
            var gx = (x * scale_x) >> 0;
            var i = gy * gfs_msg.s3.def.Ni + gx;

            fmap.fog[y][x] = gfsAltFromPRES(fmap.pressure[y][x] * 100, gfs.pres.data[i],fmap.temperature[y][x]);
        }
    }
}

function gfsDetermineWxType() {
    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {

            var shower = fmap.shower[y][x];
            var cover = fmap.cloud.cover[y][x];
            var type = 1;

            // Some basic Limits for the Type
            if ( cover > 2 && shower == 0) type = 2;
            if ( cover > 4 && shower == 0) type = 3;
            if (cover > 4 && shower == 1) type = 4;
            fmap.type[y][x] = type;
        }
    }
}

function gfsAirmassDirSpd() {
    const alt = 9;
    var dir = 0;
    var spd = 0;
    for (var y=0;y < fmap.dimension.y; y++) {
        for (var x=0;x < fmap.dimension.x; x++) {
                dir += fmap.wind[y][x][alt].direction;
                spd += fmap.wind[y][x][alt].speed;
        }
    }
    dir /= (fmap.dimension.y * fmap.dimension.x);
    spd /= (fmap.dimension.y * fmap.dimension.x);

    fmap.airmass.direction = dir >> 0;
    fmap.airmass.speed = spd / 4;  // Just take 25% of the 50000 ft average speed
}

function gfsForecastTime() {
    var forecast_time = gfs_msg.s4.def.time_forecast;
    var extra_days = (forecast_time / 24) >> 0;
    var extra_hrs = (forecast_time % 24) >> 0;
    setTimeString(gfs_msg.s1.day + extra_days, gfs_msg.s1.hour + extra_hrs,gfs_msg.s1.minute);
}

function gfsGetMsgType() {
    return gfs_msg.s4.def.param_cat * 256 + gfs_msg.s4.def.param_num;
}

function gfsProcessGrib2Msg() {
    switch (gfsGetMsgType()) {

        case gfsMsgType.PRMSL:
            if (gfs_msg.s4.def.surface1_value != 0) return;
            gfsDecodeMsg('PRMSL', gfs.prmsl);
            gfsTranscodeMsg('PRMSL',gfs.prmsl, fmap.pressure);
            gfs.prmsl.data = [];
            break;

        case gfsMsgType.VIS:
            if (gfs_msg.s4.def.surface1_value != 0) return;
            gfsDecodeMsg('VIS', gfs.vis);
            gfsTranscodeMsg('VIS', gfs.vis, fmap.visibility);
            gfs.vis.data = [];
            break;

        case gfsMsgType.TMP:
            if (gfs_msg.s4.def.surface1_value != 2) return;
            gfsDecodeMsg('TMP', gfs.tmp);
            gfsTranscodeMsg('TMP',  gfs.tmp, fmap.temperature);
            gfs.tmp.data = [];
            break;

        case gfsMsgType.TCDC:
            gfsDecodeMsg('TCDC', gfs.tcdc);
            gfsTranscodeCloudCoverage();
            gfs.tcdc.data = [];
            break;

        case gfsMsgType.UGRD:
            gfsDecodeMsg('UGRD', gfs.ugrd);
            break;

        case gfsMsgType.VGRD:
            gfsDecodeMsg('VGRD', gfs.vgrd);
            gfsTranscodeWinds(); // UGRD and VGRD come in pairs
            gfs.ugrd.data = [];
            gfs.vgrd.data = [];
            break;

        case gfsMsgType.PRES:
            gfsDecodeMsg('PRES', gfs.pres);
            gfsTranscodeCloudBase();
            gfsTranscodeFogAltitude();
            gfs.pres.data = [];
            break;

        case gfsMsgType.PRATE:
            gfsDecodeMsg('PRATE', gfs.prate);
            gfsTranscodeShowers();
            gfs.prate.data = [];
            break;

        case gfsMsgType.APCP:
            gfsDecodeMsg('APCP', gfs.apcp);
            gfs.apcp.data = [];
            break;

        case gfsMsgType.ACPCP:
            gfsDecodeMsg('ACPCP', gfs.acpcp);
            gfs.acpcp.data = [];
            break;
        default:
            console.log("Warning: Unknown Message");
    }
}

function gfsSetFmap2D(array_2d,value) {
    // Initialize values
    for (var y=0;y < fmap.dimension.y; y++) array_2d.push(new Array(fmap.dimension.x).fill(value));
}

function gfsInitFmap2D(array_2d) {
    gfsSetFmap2D(array_2d,0);
}

function gfsInitializeFmap () {
    // Erase Weather
    clearWeather();

    // Initialize fmap
    fmap.dimension = {x: 59, y: 59};
    fmap.cells = 59*59;
    fmap.version = 8;
    fmap.scaler = 1;

    // Iterate over the map cells
    const altitudes = 10;
    for (var y=0;y < fmap.dimension.y; y++) {
        var data = Array(fmap.dimension.x).fill(0);
        for (var x=0;x < fmap.dimension.x; x++) {
            var velocities = Array(altitudes).fill(0);
            for (var alt = 0; alt < altitudes; alt++) velocities[alt] = { direction: 0, speed: 0};
            data[x] = velocities;
        }
        fmap.wind.push(data);
    }

    // Setup Cloud Data
    gfsInitFmap2D(fmap.cloud.base);
    gfsInitFmap2D(fmap.cloud.cover);
    gfsSetFmap2D(fmap.cloud.size,5);
    gfsInitFmap2D(fmap.cloud.type);
    gfsInitFmap2D(fmap.shower);
    gfsInitFmap2D(fmap.fog);
    gfsInitFmap2D(fmap.type);
}

function ProcessGrib2(buffer){
    // Initialization Code
    gfsInitializeFmap();

    // Initialize GFS
    gfs_file.bytes = new Uint8Array(buffer);
    gfs_file.offset = 0;
    gfs_file.msg_cnt = 0;

    while (gfs_file.offset < gfs_file.bytes.length) {
        gfs_file.msg_cnt++;
        gfsReadGrib2Msg();
        gfsProcessGrib2Msg();
    }

    // Set BMS Weather type here
    gfsDetermineWxType();
    gfsAirmassDirSpd();
    gfsForecastTime();

    // Update Airport METAR
    updateAirportTitles();
    fmap.changed = true;
    gfs_file.bytes = [];
}
