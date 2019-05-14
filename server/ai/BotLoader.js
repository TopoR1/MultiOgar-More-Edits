// Project imports
const FakeSocket = require('./FakeSocket');
const PacketHandler = require('../ws-server/PacketHandler').default;

module.exports = class BotLoader {

    /**
     * @param {import("../GameServer")} gameServer 
     */
    constructor(gameServer) {
        this.gameServer = gameServer;
        this.nameIndex = 0;
    }
    
    getName() {
        return "bot" + ++this.nameIndex;
    }
    
    addBot() {
        let BotPlayer = require('./BotPlayer');
        let s = new FakeSocket(this.gameServer);
        s.playerTracker = new BotPlayer(this.gameServer, s);
        s.packetHandler = new PacketHandler(this.gameServer, s);

        // Add to client list
        this.gameServer.clients.push(s);

        // Add to world
        s.packetHandler.setNickname(this.getName());
    }
    
    addMinion(owner, name) {
        let MinionPlayer = require('./MinionPlayer');
        let s = new FakeSocket(this.gameServer);
        s.playerTracker = new MinionPlayer(this.gameServer, s, owner);
        s.packetHandler = new PacketHandler(this.gameServer, s);
        s.playerTracker.owner = owner;

        // Spawn minions at special size
        let size = this.gameServer.config.minionStartSize;
        if (this.gameServer.config.minionMaxStartSize > size)
            size = Math.random() * (this.gameServer.config.minionMaxStartSize - size) + size;
        s.playerTracker.spawnmass = size;

        // Add to client list
        this.gameServer.clients.push(s);

        // Add to world & set name
        if (typeof name == "undefined" || name == "") {
            name = this.gameServer.config.defaultName;
        }
        s.packetHandler.setNickname(name);
    }
}
