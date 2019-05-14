let Cell = require('./Cell');

module.exports = class Virus extends Cell{

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {{x: Number, y:Number}} pos 
     * @param {Number} size 
     */
    constructor(gameServer, pos, size) {
        super(gameServer, null, pos, size);
        this.cellType = 2;
        this.isSpiked = true;
        this.isMotherCell = false; // Not to confuse bots
        this.color = {
            r: 0x33,
            g: 0xff,
            b: 0x33
        };
    }

    /** 
     * @param {Cell} cell
     */
    canEat(cell) {
        // cannot eat if virusMaxAmount is reached
        if (this.gameServer.nodesVirus.length < this.gameServer.config.virusMaxAmount)
            return cell.cellType == 3; // virus can eat ejected mass only
    }

    /** 
     * @param {Cell} prey
     */
    onEat(prey) {
        // Called to eat prey cell
        this.setSize(Math.sqrt(this.radius + prey.radius));
        if (this._size >= this.gameServer.config.virusMaxSize) {
            this.setSize(this.gameServer.config.virusMinSize); // Reset mass
            this.gameServer.shootVirus(this, prey.boostDirection.angle());
        }
    }

    /** 
     * @param {Cell} cell
     */
    onEaten(cell) {
        if (!cell.owner)
            return;
        let config = this.gameServer.config;
        let cellsLeft = (config.virusMaxCells || config.playerMaxCells) - cell.owner.cells.length;
        if (cellsLeft <= 0)
            return;
        let splitMin = config.virusMaxPoppedSize * config.virusMaxPoppedSize / 100;
        let cellMass = cell._mass, splits = [], splitCount, splitMass;
        if (config.virusEqualPopSize) {
            // definite monotone splits
            splitCount = Math.min(~~(cellMass / splitMin), cellsLeft);
            splitMass = cellMass / (1 + splitCount);
            for (let i = 0; i < splitCount; i++)
                splits.push(splitMass);
            return this.explodeCell(cell, splits);
        }
        if (cellMass / cellsLeft < splitMin) {
            // powers of 2 monotone splits
            splitCount = 2;
            splitMass = cellMass / splitCount;
            while (splitMass > splitMin && splitCount * 2 < cellsLeft)
                splitMass = cellMass / (splitCount *= 2);
            splitMass = cellMass / (splitCount + 1);
            while (splitCount-- > 0)
                splits.push(splitMass);
            return this.explodeCell(cell, splits);
        }
        // half-half splits
        splitMass = cellMass / 2;
        let massLeft = cellMass / 2;
        while (cellsLeft-- > 0) {
            if (massLeft / cellsLeft < splitMin) {
                splitMass = massLeft / cellsLeft;
                while (cellsLeft-- > 0)
                    splits.push(splitMass);
            }
            while (splitMass >= massLeft && cellsLeft > 0)
                splitMass /= 2;
            splits.push(splitMass);
            massLeft -= splitMass;
        }
        this.explodeCell(cell, splits);
    }

    /** 
     * @param {Cell} cell
     * @param {Number[]} splits
     */
    explodeCell(cell, splits) {
        for (let i = 0; i < splits.length; i++)
            this.gameServer.splitPlayerCell(cell.owner, cell, 2 * Math.PI * Math.random(), splits[i]);
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onAdd(gameServer) {
        gameServer.nodesVirus.push(this);
    }

    /** 
     * @param {import("../GameServer")} gameServer
     */
    onRemove(gameServer) {
        let index = gameServer.nodesVirus.indexOf(this);
        if (index != -1)
            gameServer.nodesVirus.splice(index, 1);
    }
}







