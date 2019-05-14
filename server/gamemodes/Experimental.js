let FFA = require('./FFA'); // Base gamemode
let { Virus, MotherCell } = require('../entity');

module.exports = class Experimental extends FFA{

    constructor() {
        super();
        this.ID = 2;
        this.name = "Experimental";
        this.specByLeaderboard = true;
        // Gamemode Specific Variables
        this.nodesMother = [];
        // Config
        this.motherSpawnInterval = 125; // How many ticks it takes to spawn another mother cell (5 seconds)
        this.motherMinAmount = 10;
    }
    // Gamemode Specific Functions
    spawnMotherCell(gameServer) {
        // Checks if there are enough mother cells on the map
        if (this.nodesMother.length >= this.motherMinAmount) {
            return;
        }
        // Spawn if no cells are colliding
        let mother = new MotherCell(gameServer, gameServer.randomPos(), 149);
        if (!gameServer.willCollide(mother))
            gameServer.addNode(mother);
    }
    // Override
    onServerInit(gameServer) {
        // Called when the server starts
        gameServer.run = true;
        // Ovveride functions for special virus mechanics
        let self = this;
        Virus.prototype.onEat = function (prey) {
            // Pushes the virus
            this.setBoost(220, prey.boostDirection.angle());
        };

        MotherCell.prototype.onAdd = function () {
            self.nodesMother.push(this);
        };

        MotherCell.prototype.onRemove = function () {
            let index = self.nodesMother.indexOf(this);
            if (index != -1)
                self.nodesMother.splice(index, 1);
        };
    }
    onTick(gameServer) {
        // Mother Cell Spawning
        if ((gameServer.tickCounter % this.motherSpawnInterval) === 0) {
            this.spawnMotherCell(gameServer);
        }
        let updateInterval;
        for (let i = 0; i < this.nodesMother.length; ++i) {
            let motherCell = this.nodesMother[i];
            if (motherCell._size <= motherCell.motherCellMinSize)
                updateInterval = Math.random() * (50 - 25) + 25;
            else
                updateInterval = 2;
            if ((gameServer.tickCounter % ~~updateInterval) === 0) {
                motherCell.onUpdate();
            }
        }
    }
}