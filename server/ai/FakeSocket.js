// A fake socket for bot players

module.exports = class FakeSocket {

    constructor(gameServer) {
        this.server = gameServer;
        this.isCloseRequest = false;
        /** @type {import("../ws-server/PlayerTracker")} */
        this.playerTracker = null;
        /** @type {import("../ws-server/PacketHandler")} */
        this.packetHandler = null;
    }
    
    // Override
    sendPacket(packet) {
        // Fakes sending a packet
        return;
    }

    close(error) {
        this.isCloseRequest = true;
    }
}
