let Cell = require('./Cell');

module.exports = class EjectedMass extends Cell{

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {{x: Number, y:Number}} pos 
     * @param {Number} size 
     */
    constructor(gameServer, pos, size) {
        super(gameServer, null, pos, size);
        this.cellType = 3;
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onAdd(gameServer) {
        // Add to list of ejected mass
        gameServer.nodesEjected.push(this);
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onRemove(gameServer) {
        // Remove from list of ejected mass
        let index = gameServer.nodesEjected.indexOf(this);
        if (index != -1) {
            gameServer.nodesEjected.splice(index, 1);
        }
    }
}



