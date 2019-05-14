let Cell = require('./Cell');
let Packet = require('../packet');

module.exports = class PlayerCell extends Cell{

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {import("../game-server/Player")} owner
     * @param {{x: Number, y:Number}} pos 
     * @param {Number} size 
     */
    constructor(gameServer, owner, pos, size) {
        super(gameServer, owner, pos, size);
        this.cellType = 0;
        this._canRemerge = false;
    }

    /** 
     * @param {Cell} cell
     */
    canEat(cell) {
        return true; // player cell can eat anyone
    }

    /** 
     * @param {Number} dist
     */
    getSpeed(dist) {
        let speed = 2.2 * Math.pow(this._size, -0.439);
        speed *= 40 * this.gameServer.config.playerSpeed;
        return Math.min(dist, speed) / dist;
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onAdd(gameServer) {
        // Add to player nodes list
        this.color = this.owner.color;
        this.owner.cells.push(this);
        this.owner.socket.packetHandler.sendPacket(new Packet.AddNode(this.owner, this));
        this.gameServer.nodesPlayer.unshift(this);
        // Gamemode actions
        gameServer.gameMode.onCellAdd(this);
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onRemove(gameServer) {
        // Remove from player cell list
        let index = this.owner.cells.indexOf(this);
        if (index != -1)
            this.owner.cells.splice(index, 1);
        index = this.gameServer.nodesPlayer.indexOf(this);
        if (index != -1)
            this.gameServer.nodesPlayer.splice(index, 1);
        // Gamemode actions
        gameServer.gameMode.onCellRemove(this);
    }
}