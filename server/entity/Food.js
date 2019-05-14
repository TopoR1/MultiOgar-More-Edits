let Cell = require('./Cell');

module.exports = class Food extends Cell {

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {{x: Number, y:Number}} pos 
     * @param {Number} size 
     */
    constructor(gameServer, pos, size) {
        super(gameServer, null, pos, size);
        this.cellType = 1;
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onAdd(gameServer) {
        gameServer.nodesFood.push(this);
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onRemove(gameServer) {
        // Remove from list of foods
        let index = gameServer.nodesFood.indexOf(this);
        if (index != -1) {
            gameServer.nodesFood.splice(index, 1);
        }
    }
}



