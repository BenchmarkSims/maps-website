//
// Map Symbology Contains the data and API for handling the
// MIL-STD-2525D Symbols for the interactive maps
//

// SIDC Fields
//
// SET A
// -----
// Version:     1,2  - 10 No Changes to Symbology
// Identity:    3,4  - 03 Friend, 06 Hostile
// Symbol Set:  5,6  - 01 Air, 10 Land, 30 Sea
// Status:      7    - 0 Present, 3 Damaged, 4 Destroyed
// Task Force:  8    - 0 Unknown
// Descriptor:  9,10 - 00 Unknown, 16 Battalion
//
// SET B (Entity)
// -----
// Entity:      11,12
// Type:        13,14
// Subtype:     15,16
// Modifier 1   17,18
// Modifier 2   19,20

const entity_tbl = [
    // Land Friendly
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10031000161211000000", entity: "Infantry", icon: "../common/assets/10031000161211000000.ico"},
    {sidc: "10031000161301000000", entity: "Air Defense", icon: "../common/assets/10031000161301000000.ico"},
    {sidc: "10031000161211020000", entity: "Mechanized", icon: "../common/assets/10031000161211020000.ico"},
    {sidc: "10031000161211040000", entity: "Motorized", icon: "../common/assets/10031000161211040000.ico"},
    {sidc: "10031000161205000000", entity: "Armored", icon: "../common/assets/10031000161205000000.ico"},
    {sidc: "10031000161407000000", entity: "Engineer", icon: "../common/assets/10031000161407000000.ico"},
    {sidc: "10031000161303000000", entity: "Field Artillery", icon: "../common/assets/10031000161303000000.ico"},
    {sidc: "10031000161303010000", entity: "Propelled Artillery", icon: "../common/assets/10031000161303010000.ico"},
    {sidc: "10031000161634000000", entity: "Supply", icon: "../common/assets/10031000161634000000.ico"},

    // Air Friendly
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10030100001101020000", entity: "Attack",  icon: "../common/assets/10030100001101020000.ico"},
    {sidc: "10030100001101030000", entity: "Bomber",  icon: "../common/assets/10030100001101030000.ico"},
    {sidc: "10030100001101040000", entity: "Fighter", icon: "../common/assets/10030100001101040000.ico"},
    {sidc: "10030100001101050000", entity: "Fighter/Bomber", icon: "../common/assets/10030100001101050000.ico"},
    {sidc: "10030100001101070000", entity: "Cargo", icon:  "../common/assets/10030100001101070000.ico"},
    {sidc: "10030100001101080000", entity: "Jammer", icon: "../common/assets/10030100001101080000.ico"},
    {sidc: "10030100001101090000", entity: "Tanker", icon: "../common/assets/10030100001101090000.ico"},
    {sidc: "10030100001101110000", entity: "Reconnaisance", icon: "../common/assets/10030100001101110000.ico"},
    {sidc: "10030100001101160000", entity: "Airborne Early Warn.", icon: "../common/assets/10030100001101160000.ico"},
    {sidc: "10030100001102000000", entity: "Rotary-Wing", icon: "../common/assets/10030100001102000000.ico"},

    // Sea Friendly
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10033000001201000000", entity: "Carrier",  icon: "../common/assets/10033000001201000000.ico"},
    {sidc: "10033000001202000000", entity: "Surface Combatant",  icon: "../common/assets/10033000001202000000.ico"},
    {sidc: "10033000001401000000", entity: "Merchant Ship",  icon: "../common/assets/10033000001401000000.ico"},

    // Land Hostile
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10061000161211000000", entity: "Infantry", icon: "../common/assets/10061000161211000000.ico"},
    {sidc: "10061000161301000000", entity: "Air Defense", icon: "../common/assets/10061000161301000000.ico"},
    {sidc: "10061000161211020000", entity: "Mechanized", icon: "../common/assets/10061000161211020000.ico"},
    {sidc: "10061000161211040000", entity: "Motorized", icon: "../common/assets/10061000161211040000.ico"},
    {sidc: "10061000161205000000", entity: "Armored", icon: "../common/assets/10061000161205000000.ico"},
    {sidc: "10061000161407000000", entity: "Engineer", icon: "../common/assets/10061000161407000000.ico"},
    {sidc: "10061000161303000000", entity: "Field Artillery", icon: "../common/assets/10061000161303000000.ico"},
    {sidc: "10061000161303010000", entity: "Propelled Artillery", icon: "../common/assets/10061000161303010000.ico"},
    {sidc: "10061000161634000000", entity: "Supply", icon: "../common/assets/10061000161634000000.ico"},

    // Air Hostile
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10060100001101020000", entity: "Attack",  icon: "../common/assets/10060100001101020000.ico"},
    {sidc: "10060100001101030000", entity: "Bomber",  icon: "../common/assets/10060100001101030000.ico"},
    {sidc: "10060100001101040000", entity: "Fighter", icon: "../common/assets/10060100001101040000.ico"},
    {sidc: "10060100001101050000", entity: "Fighter/Bomber", icon: "../common/assets/10060100001101050000.ico"},
    {sidc: "10060100001101070000", entity: "Cargo", icon: "../common/assets/10060100001101070000.ico"},
    {sidc: "10060100001101080000", entity: "Jammer", icon: "../common/assets/10060100001101080000.ico"},
    {sidc: "10060100001101090000", entity: "Tanker", icon: "../common/assets/10060100001101090000.ico"},
    {sidc: "10060100001101110000", entity: "Reconnaisance", icon: "../common/assets/10060100001101110000.ico"},
    {sidc: "10060100001101160000", entity: "Airborne Early Warn.", icon: "../common/assets/10060100001101160000.ico"},
    {sidc: "10060100001102000000", entity: "Rotary-Wing", icon: "../common/assets/10060100001102000000.ico"},

    // Sea Hostile
    //      VVIIYYUFDDEETTSSM1M2
    {sidc: "10063000001201000000", entity: "Carrier",  icon: "../common/assets/10063000001201000000.ico"},
    {sidc: "10063000001202000000", entity: "Surface Combatant",  icon: "../common/assets/10063000001202000000.ico"},
    {sidc: "10063000001401000000", entity: "Merchant Ship",  icon: "../common/assets/10063000001401000000.ico"},
];

var sidc_next = 0;

function nextSymbol(sidc) {
    for (i=sidc_next;i < entity_tbl.length;i++) {
        if (entity_tbl[i].sidc.startsWith(sidc)) {
            sidc_next = i + 1;
            return(entity_tbl[i]);
        }
    }
    return null;
}

function firstSymbol(sidc) {
    sidc_next = 0;

    return (nextSymbol(sidc));
}


