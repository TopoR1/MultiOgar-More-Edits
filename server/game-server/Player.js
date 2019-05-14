const Vec2 = require("../modules/Vec2");

module.exports = class Player {

    /**
     * @param {import("./GameServer")} gameServer
     * @param {String} hash 
     * @param {Number} pid
     */
    constructor(gameServer, hash, pid) {
        this.gameServer = gameServer
        this.hash = hash;
        this.pid = pid;
        this.init();
    }

    init() {

        this.isRemoved = false;
        this.name = "";
        this.skin = "";
        this.color = { r: 0, g: 0, b: 0 };
        /** @type {import("../entity/Cell")[]} */
        this.viewNodes = [];
        /** @type {Player)[]} */
        this.playerNodes = [];
        /** @type {import("../entity/Cell")[]} */
        this.cells = [];
        this.mergeOverride = false; // Triggered by console command
        this.score = 0; // Needed for leaderboard
        this.scale = 1;
        this.borderCounter = 0;
        this.connectedTime = new Date();
        this.tickLeaderboard = 0;
        this.team = 0;
        this.spectate = false;
        this.freeRoam = true; // Free-roam mode enables player to move in spectate mode
        
        /** @type {Player} */
        this.spectateTarget = null; // Spectate target, null for largest player
        this.lastKeypressTick = 0;
        this.centerPos = new Vec2(0, 0);
        this.mouse = new Vec2(0, 0);
        this.viewBox = {
            minx: 0,
            miny: 0,
            maxx: 0,
            maxy: 0
        };
        this.isMuted = false;
        // Custom commands
        this.spawnmass = 0;
        this.frozen = false;
        this.customspeed = 0;
        this.rec = false;

        // Gamemode function
        this.gameServer.gameMode.onPlayerInit(this);
        // Only scramble if enabled in config
        this.scramble();
    }

    /**
     * @param {String} reason 
     */
    disconnect(reason) {

    }

    // Setters/Getters
    scramble() {
        if (!this.gameServer.config.serverScrambleLevel) {
            this.scrambleId = 0;
            this.scrambleX = 0;
            this.scrambleY = 0;
        }
        else {
            this.scrambleId = (Math.random() * 0xFFFFFFFF) >>> 0;
            // avoid mouse packet limitations
            let maxx = Math.max(0, 31767 - this.gameServer.border.width);
            let maxy = Math.max(0, 31767 - this.gameServer.border.height);
            let x = maxx * Math.random();
            let y = maxy * Math.random();
            if (Math.random() >= 0.5)
                x = -x;
            if (Math.random() >= 0.5)
                y = -y;
            this.scrambleX = x;
            this.scrambleY = y;
        }
        this.borderCounter = 0;
    }

    getScale() {
        this.score = 0; // reset to not cause bugs with leaderboard
        let scale = 0; // reset to not cause bugs with viewbox
        for (let i = 0; i < this.cells.length; i++) {
            scale += this.cells[i]._size;
            this.score += this.cells[i]._mass;
        }
        if (!scale)
            return scale = this.score = 0.4; // reset scale
        else
            return this.scale = Math.pow(Math.min(64 / scale, 1), 0.4);
    }

    joinGame(name, skin) {
        if (this.cells.length)
            return;
        if (skin)
            this.setSkin(skin);
        if (!name)
            name = "An unnamed cell";
        this.setName(name);
        this.spectate = false;
        this.freeRoam = false;
        this.spectateTarget = null;
        /** @type {import("./PacketHandler")} */
        let packetHandler = this.socket.packetHandler;
        if (!this.isMi && this.socket.isConnected != null) {
            // some old clients don't understand ClearAll message
            // so we will send update for them
            if (packetHandler.protocol < 6) {
                packetHandler.sendPacket(new UpdateNodes(this, [], [], [], this.clientNodes));
            }
            packetHandler.sendPacket(new ClearAll());
            this.clientNodes = [];
            this.scramble();
            if (this.gameServer.config.serverScrambleLevel < 2) {
                // no scramble / lightweight scramble
                packetHandler.sendPacket(new SetBorder(this, this.gameServer.border));
            }
            else if (this.gameServer.config.serverScrambleLevel == 3) {
                // Ruins most known minimaps (no border)
                let border = {
                    minx: this.gameServer.border.minx,
                    miny: this.gameServer.border.miny,
                    maxx: this.gameServer.border.maxx,
                    maxy: this.gameServer.border.maxy
                };
                packetHandler.sendPacket(new SetBorder(this, border));
            }
        }
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
    }
}