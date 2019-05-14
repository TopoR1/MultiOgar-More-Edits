let BinaryWriter = require("./BinaryWriter");

module.exports = class AddNode {

    constructor(playerTracker, item) {
        this.playerTracker = playerTracker;
        this.item = item;
    }

    /**
     * @param {String} protocol 
     */
    build(protocol) {
        let writer = new BinaryWriter();
        writer.writeUInt8(0x20); // Packet ID
        writer.writeUInt32((this.item.nodeId ^ this.playerTracker.scrambleId) >>> 0);
        return writer.toBuffer();
    }
}