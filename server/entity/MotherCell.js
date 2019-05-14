const Food = require('./Food');
const Virus = require('./Virus');

module.exports = class MotherCell extends Virus{

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {{x: Number, y:Number}} pos 
     * @param {Number} size 
     */
    constructor(gameServer, pos, size) {
        super(gameServer, pos, size);
        this.cellType = 2;
        this.isSpiked = true;
        this.isMotherCell = true; // Not to confuse bots
        this.color = { r: 0xce, g: 0x63, b: 0x63 };
        this.motherCellMinSize = 149; // vanilla 149 (mass = 149*149/100 = 222.01)
        this.motherCellSpawnAmount = 2;
        if (!this._size) {
            this.setSize(this.motherCellMinSize);
        }
    }

    /** 
     * @param {import("./Cell")} cell
     */
    canEat(cell) {
        let maxMass = this.gameServer.config.motherCellMaxMass;
        if (maxMass && this._mass >= maxMass)
            return false;
        return cell.cellType == 0 || // can eat player cell
            cell.cellType == 2 || // can eat virus
            cell.cellType == 3; // can eat ejected mass
    }
    
    onUpdate() {
        let maxFood = this.gameServer.config.foodMaxAmount;
        if (this.gameServer.nodesFood.length >= maxFood) {
            return;
        }
        let size1 = this._size;
        let size2 = this.gameServer.config.foodMinSize;
        for (let i = 0; i < this.motherCellSpawnAmount; i++) {
            size1 = Math.sqrt(size1 * size1 - size2 * size2);
            size1 = Math.max(size1, this.motherCellMinSize);
            this.setSize(size1);
            // Spawn food with size2
            let angle = Math.random() * 2 * Math.PI;
            let pos = {
                x: this.position.x + size1 * Math.sin(angle),
                y: this.position.y + size1 * Math.cos(angle)
            };
            // Spawn food
            let food = new Food(this.gameServer, pos, size2);
            food.color = this.gameServer.getRandomColor();
            this.gameServer.addNode(food);
            // Eject to random distance
            food.setBoost(32 + 42 * Math.random(), angle);
            if (this.gameServer.nodesFood.length >= maxFood || size1 <= this.motherCellMinSize) {
                break;
            }
        }
        this.gameServer.updateNodeQuad(this);
    }
}
