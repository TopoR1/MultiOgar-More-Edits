let PlayerTracker = require('../ws-server/PlayerTracker');

module.exports = class MinionPlayer extends PlayerTracker{

    /**
     * @param {import("./GameServer")} gameServer 
     * @param {import("ws")|import("./ai/FakeSocket")} socket 
     * @param {import("../ws-server/PlayerTracker")} owner
     */
    constructor(gameServer, socket, owner) {
        super(gameServer, socket);
        this.owner = owner;
        this.isMi = true; // Marks as minion
        this.socket.isConnected = true;
    }

    checkConnection() {
        if (this.socket.isCloseRequest) {
            while (this.cells.length) {
                this.gameServer.removeNode(this.cells[0]);
            }
            this.isRemoved = true;
            return;
        }
        if (!this.cells.length) {
            this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
            if (!this.cells.length)
                this.socket.close();
        }
        // remove if owner has disconnected or has no control
        if (this.owner.socket.isConnected == false || !this.owner.minionControl)
            this.socket.close();
        // frozen or not
        if (this.owner.minionFrozen)
            this.frozen = true;
        else
            this.frozen = false;
        // split cells
        if (this.owner.minionSplit)
            this.socket.packetHandler.pressSpace = true;
        // eject mass
        if (this.owner.minionEject)
            this.socket.packetHandler.pressW = true;
        // follow owners mouse by default
        this.mouse = this.owner.mouse;
        // pellet-collecting mode
        if (this.owner.collectPellets) {
            this.viewNodes = [];
            let self = this;
            this.viewBox = this.owner.viewBox;
            this.gameServer.quadTree.find(this.viewBox, function (check) {
                if (check.cellType == 1)
                    self.viewNodes.push(check);
            });
            let bestDistance = 1e999;
            for (let i in this.viewNodes) {
                let cell = this.viewNodes[i];
                let dx = this.cells[0].position.x - cell.position.x;
                let dy = this.cells[0].position.y - cell.position.y;
                if (dx * dx + dy * dy < bestDistance) {
                    bestDistance = dx * dx + dy * dy;
                    this.mouse = cell.position;
                }
            }
        }
    }
}


