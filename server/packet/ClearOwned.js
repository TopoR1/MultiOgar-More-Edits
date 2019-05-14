const BinaryWriter = require("./BinaryWriter");

module.exports = class ClearOwned {
    constructor() { }
    build(protocol) {
        let writer = new BinaryWriter();
        writer.writeUInt8(0x14);
        return writer.toBuffer();
    }
}