const BinaryWriter = require("./BinaryWriter");

module.exports = class ClearAll {
    constructor() { }
    build(protocol) {
        let writer = new BinaryWriter();
        writer.writeUInt8(0x12);
        return writer.toBuffer();
    }
}