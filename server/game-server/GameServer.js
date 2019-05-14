// Library imports
const Vec2 = require('../modules/Vec2');
const logger = require('../../../../../util/logger');
const BotLoader = require('../ai/BotLoader');
const Gamemode = require('../gamemodes');
const QuadNode = require('../modules/QuadNode');
const Player = require("./Player");
const { Food, EjectedMass, PlayerCell, Virus } = require('../entity');

// GameServer implementation
module.exports = class GameServer {

    constructor() {

        // Location of source files - For renaming or moving source files!
        this.srcFiles = "../server";

        // Set border, quad-tree
        this.setBorder(this.config.borderWidth, this.config.borderHeight);
        this.quadTree = new QuadNode(this.border);
    }

    /**
     * Init instance variables
     */
    init() {
        this.run = true;
        this.version = process.env.OGAR_VERSION || '1.6.1';
        this.lastNodeId = 1;
        this.lastPlayerId = 1;

        /** @type {import("./Player")[]} */
        this.players = [];
        /** @type {import("../entity/Cell")[]} */
        this.nodes = []; // Total nodes
        /** @type {import("../entity/Virus")[]} */
        this.nodesVirus = []; // Virus nodes
        /** @type {import("../entity/Food")[]} */
        this.nodesFood = []; // Food nodes
        /** @type {import("../entity/EjectedMass")[]} */
        this.nodesEjected = []; // Ejected nodes
        /** @type {import("../entity/PlayerCell")[]} */
        this.nodesPlayer = []; // Player nodes

        /** @type {import("../entity/Cell")[]} */
        this.movingNodes = []; // For move engine
        this.leaderboard = []; // For leaderboard
        this.leaderboardType = -1; // No type
        this.bots = new BotLoader(this);

        // Main loop tick
        this.startTime = Date.now();
        this.stepDateTime = 0;
        this.timeStamp = 0;
        this.updateTime = 0;
        this.updateTimeAvg = 0;
        this.tickCounter = 0;
        this.disableSpawn = false;

        // Config
        this.config = require("./config.default.json");
        /** @type {String[]} */
        this.ipBanList = [];
        this.userList = [];
        this.badWords = [];
        this.loadFiles();
    }

    start() {    
        // Set up gamemode(s)
        this.gameMode = Gamemode.get(this.config.serverGamemode);
        this.gameMode.onServerInit(this);
        this.onServerOpen();
    }

    onServerOpen() {
        // Start Main Loop
        setTimeout(this.timerLoop, 1);

        // Done
        logger.log("Current game mode is " + this.gameMode.name);

        // Player bots (Experimental)
        if (this.config.serverBots) {
            for (let i = 0; i < this.config.serverBots; i++)
                this.bots.addBot();
            logger.log("Added " + this.config.serverBots + " player bots");
        }
    }

    /**
     * @param {String} hash 
     */
    onClient(hash) {

        let player = new Player(hash);

        // let PlayerTracker = require('../ws-server/PlayerTracker');
        // ws.playerTracker = new PlayerTracker(this, ws);
        // let PacketHandler = require('../ws-server/PacketHandler');
        // ws.packetHandler = new PacketHandler(this, ws);
    
        this.player.push(player);
    }

    /**
     * @param {String} ipAddress 
     */
    checkIpBan(ipAddress) {
        if (!this.ipBanList || !this.ipBanList.length || ipAddress == "127.0.0.1") {
            return false;
        }
        if (this.ipBanList.indexOf(ipAddress) >= 0) {
            return true;
        }
        let ipBin = ipAddress.split('.');
        if (ipBin.length != 4) {
            // unknown IP format
            return true;
        }
        let subNet2 = ipBin[0] + "." + ipBin[1] + ".*.*";
        if (this.ipBanList.indexOf(subNet2) >= 0) {
            return true;
        }
        let subNet1 = ipBin[0] + "." + ipBin[1] + "." + ipBin[2] + ".*";
        if (this.ipBanList.indexOf(subNet1) >= 0) {
            return true;
        }
        return false;
    }

    /**
     * @param {import("../entity/Cell")} node 
     */
    addNode(node) {
        // Add to quad-tree & node list
        let x = node.position.x;
        let y = node.position.y;
        let s = node._size;
        node.quadItem = {
            cell: node, // update viewbox for players
            bound: {
                minx: x - s,
                miny: y - s,
                maxx: x + s,
                maxy: y + s
            }
        };
        this.quadTree.insert(node.quadItem);
        this.nodes.push(node);

        // Special on-add actions
        node.onAdd(this);
    }

    /**
     * @param {Number} width 
     * @param {Number} height 
     */
    setBorder(width, height) {
        let hw = width / 2;
        let hh = height / 2;
        this.border = {
            minx: -hw,
            miny: -hh,
            maxx: hw,
            maxy: hh,
            width: width,
            height: height
        };
    }

    getRandomColor() {
        // get random
        let colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function () {
            return 0.5 - Math.random();
        });
        // return random
        return {
            r: colorRGB[0],
            g: colorRGB[1],
            b: colorRGB[2]
        };
    }

    /**
     * @param {import("../modules/QuadNode")} node 
     */
    removeNode(node) {
        // Remove from quad-tree
        node.isRemoved = true;
        this.quadTree.remove(node.quadItem);
        node.quadItem = null;

        // Remove from node lists
        let i = this.nodes.indexOf(node);
        if (i > -1) this.nodes.splice(i, 1);
        i = this.movingNodes.indexOf(node);
        if (i > -1) this.movingNodes.splice(i, 1);

        // Special on-remove actions
        node.onRemove(this);
    }

    updateClients() {
        // check dead players
        let len = this.player.length;
        for (let player of this.players) {
            if (!this.player[i]) {
                i++;
                continue;
            }
            this.player[i].playerTracker.checkConnection();
            if (this.player[i].playerTracker.isRemoved)
                // remove dead player
                this.player.splice(i, 1);
            else
                i++;
        }
        // update
        for (let i = 0; i < len; i++) {
            if (!this.player[i]) continue;
            this.player[i].playerTracker.updateTick();
        }
        for (let i = 0; i < len; i++) {
            if (!this.player[i]) continue;
            this.player[i].playerTracker.sendUpdate();
        }
    }

    updateLeaderboard() {
        // Update leaderboard with the gamemode's method
        this.leaderboard = [];
        this.leaderboardType = -1;
        this.gameMode.updateLB(this, this.leaderboard);

        if (!this.gameMode.specByLeaderboard) {
            // Get player with largest score if gamemode doesn't have a leaderboard
            let players = this.player.valueOf();

            // Use sort function
            players.sort(function (a, b) {
                return b.playerTracker._score - a.playerTracker._score;
            });
            this.largestClient = null;
            if (players[0]) this.largestClient = players[0].playerTracker;
        } else {
            this.largestClient = this.gameMode.rankOne;
        }
    }

    onChatMessage(from, to, message) {
        if (!message) return;
        message = message.trim();
        if (message === "") {
            return;
        }
        if (from && message.length && message[0] == '/') {
            // player command
            message = message.slice(1, message.length);
            // from.socket.playerCommand.executeCommandLine(message);
            return;
        }
        if (!this.config.serverChat || (from && from.isMuted)) {
            // chat is disabled or player is muted
            return;
        }
        if (message.length > 64) {
            message = message.slice(0, 64);
        }
        if (this.config.serverChatAscii) {
            for (let i = 0; i < message.length; i++) {
                if ((message.charCodeAt(i) < 0x20 || message.charCodeAt(i) > 0x7F) && from) {
                    this.sendChatMessage(null, from, "Message failed - You can use ASCII text only!");
                    return;
                }
            }
        }
        if (this.checkBadWord(message) && from && this.config.badWordFilter === 1) {
            this.sendChatMessage(null, from, "Message failed - Stop insulting others! Keep calm and be friendly please.");
            return;
        }
        this.sendChatMessage(from, to, message);
    }

    checkBadWord(value) {
        if (!value) return false;
        value = " " + value.toLowerCase().trim() + " ";
        for (let i = 0; i < this.badWords.length; i++) {
            if (value.indexOf(this.badWords[i]) >= 0) {
                return true;
            }
        }
        return false;
    }

    sendChatMessage(from, to, message) {
        for (let i = 0, len = this.player.length; i < len; i++) {
            if (!this.player[i]) continue;
            if (!to || to == this.player[i].playerTracker) {
                let Packet = require('../packet');
                if (this.config.separateChatForTeams && this.gameMode.haveTeams) {
                    //  from equals null if message from server
                    if (from == null || from.team === this.player[i].playerTracker.team) {
                        this.player[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                    }
                } else {
                    this.player[i].packetHandler.sendPacket(new Packet.ChatMessage(from, message));
                }
            }

        }
    }

    /**
     * @param {GameServer} self 
     */
    timerLoop(self) {

        let timeStep = 40; // vanilla: 40
        let ts = Date.now();
        let dt = ts - self.timeStamp;
        if (dt < timeStep - 5) {
            setTimeout(self.timerLoopBind, timeStep - 5);
            return;
        }
        if (dt > 120) self.timeStamp = ts - timeStep;
        // update average, calculate next
        self.updateTimeAvg += 0.5 * (self.updateTime - self.updateTimeAvg);
        self.timeStamp += timeStep;
        setTimeout(self.timerLoop, 0, self);
        setTimeout(self.mainLoop, 0, self);
    }

    /**
     * @param {GameServer} self 
     */
    mainLoop(self) {
        self.stepDateTime = Date.now();
        let tStart = process.hrtime();

        // Restart
        if (self.tickCounter > self.config.serverRestart) {
            self.init();
            self.players.forEach(player => player.disconnect("Restart"));
            self.start();
        };

        // Loop main functions
        if (self.run) {
            // Move moving nodes first
            for (let cell of self.movingNodes) {
                if (cell.isRemoved) return;
                // Scan and check for ejected mass / virus collisions
                self.boostCell(cell);
                self.quadTree.find(cell.quadItem.bound, check => {
                    let m = self.checkCellCollision(cell, check);
                    if (cell.cellType == 3 && check.cellType == 3 && !self.config.mobilePhysics)
                        self.resolveRigidCollision(m);
                    else
                        self.resolveCollision(m);
                });
                if (!cell.isMoving)
                    self.movingNodes = null;
            }

            // Update players and scan for collisions
            let eatCollisions = [];
            for (let cell of self.nodesPlayer) {
                if (cell.isRemoved) return;
                // Scan for eat/rigid collisions and resolve them
                self.quadTree.find(cell.quadItem.bound, check => {
                    let m = self.checkCellCollision(cell, check);
                    if (self.checkRigidCollision(m))
                        self.resolveRigidCollision(m);
                    else if (check != cell)
                        eatCollisions.unshift(m);
                });
                self.movePlayer(cell, cell.owner);
                self.boostCell(cell);
                self.autoSplit(cell, cell.owner);
                // Decay player cells once per second
                if (((self.tickCounter + 3) % 25) === 0)
                    self.updateSizeDecay(cell);
                // Remove external minions if necessary
                if (cell.owner.isMinion) {
                    cell.owner.disconnect(1000, "Minion");
                    self.removeNode(cell);
                }
            };
            eatCollisions.forEach((m) => {
                self.resolveCollision(m);
            });
            if ((self.tickCounter % self.config.spawnInterval) === 0) {
                // Spawn food & viruses
                self.spawnCells();
            }
            self.gameMode.onTick(self);
            self.tickCounter++;
        }
        if (!self.run && self.gameMode.IsTournament)
            self.tickCounter++;
        self.updateClients();

        // update leaderboard
        if (((self.tickCounter + 7) % 25) === 0)
            self.updateLeaderboard(); // once per second

        // update-update time
        let tEnd = process.hrtime(tStart);
        self.updateTime = tEnd[0] * 1e3 + tEnd[1] / 1e6;
    }

    /**
     * 
     * @param {import("../entity/PlayerCell")} cell 
     * @param {Player} player 
     */
    movePlayer(cell, player) {

        if (player.frozen || (!player.mouse[0] && !player.mouse[1]))
            return; // Do not move

        // get movement from vector
        let d = player.mouse.clone().sub(cell.position);
        let move = cell.getSpeed(d.sqDist()); // movement speed
        if (!move) return; // avoid jittering
        cell.position.add(d, move);

        // update remerge
        let time = this.config.playerRecombineTime,
            base = Math.max(time, cell._size * 0.2) * 25;
        // instant merging conditions
        if (!time || player.rec || player.mergeOverride) {
            cell._canRemerge = cell.boostDistance < 100;
            return; // instant merge
        }
        // regular remerge time
        cell._canRemerge = cell.getAge() >= base;
    }
    updateSizeDecay(cell) {
        let rate = this.config.playerDecayRate,
            cap = this.config.playerDecayCap;

        if (!rate || cell._size <= this.config.playerMinSize)
            return;

        // remove size from cell at decay rate
        if (cap && cell._mass > cap) rate *= 10;
        let decay = 1 - rate * this.gameMode.decayMod;
        cell.setSize(Math.sqrt(cell.radius * decay));
    }

    boostCell(cell) {
        if (cell.isMoving && !cell.boostDistance || cell.isRemoved) {
            cell.boostDistance = 0;
            cell.isMoving = false;
            return;
        }
        // decay boost-speed from distance
        let speed = cell.boostDistance / 9; // val: 87
        cell.boostDistance -= speed; // decays from speed
        cell.position.add(cell.boostDirection, speed)

        // update boundries
        cell.checkBorder(this.border);
        this.updateNodeQuad(cell);
    }
    autoSplit(cell, player) {
        // get size limit based off of rec mode
        let maxSize = player.rec ? maxSize = 1e9 : this.config.playerMaxSize;

        // check size limit
        if (player.mergeOverride || cell._size < maxSize) return;
        if (player.cells.length >= this.config.playerMaxCells || this.config.mobilePhysics) {
            // cannot split => just limit
            cell.setSize(maxSize);
        } else {
            // split in random direction
            let angle = Math.random() * 2 * Math.PI;
            this.splitPlayerCell(player, cell, angle, cell._mass * .5);
        }
    }

    /**
     * @param {import("../modules/QuadNode")} node 
     */
    updateNodeQuad(node) {
        // update quad tree
        let item = node.quadItem.bound;
        item.minx = node.position.x - node._size;
        item.miny = node.position.y - node._size;
        item.maxx = node.position.x + node._size;
        item.maxy = node.position.y + node._size;
        this.quadTree.remove(node.quadItem);
        this.quadTree.insert(node.quadItem);
    }
    checkCellCollision(cell, check) {
        let p = check.position.clone().sub(cell.position);

        // create collision manifold
        return {
            cell: cell,
            check: check,
            d: p.sqDist(), // distance from cell to check
            p: p // check - cell position
        };
    }
    checkRigidCollision(m) {
        if (!m.cell.owner || !m.check.owner)
            return false;

        if (m.cell.owner != m.check.owner) {
            // Minions don't collide with their team when the config value is 0
            if (this.gameMode.haveTeams && m.check.owner.isMi || m.cell.owner.isMi && this.config.minionCollideTeam === 0) {
                return false;
            } else {
                // Different owners => same team
                return this.gameMode.haveTeams &&
                    m.cell.owner.team == m.check.owner.team;
            }
        }
        let r = this.config.mobilePhysics ? 1 : 13;
        if (m.cell.getAge() < r || m.check.getAge() < r) {
            return false; // just splited => ignore
        }
        return !m.cell._canRemerge || !m.check._canRemerge;
    }
    resolveRigidCollision(m) {
        let push = (m.cell._size + m.check._size - m.d) / m.d;
        if (push <= 0 || m.d == 0) return; // do not extrude

        // body impulse
        let rt = m.cell.radius + m.check.radius;
        let r1 = push * m.cell.radius / rt;
        let r2 = push * m.check.radius / rt;

        // apply extrusion force
        m.cell.position.sub2(m.p, r2);
        m.check.position.add(m.p, r1);
    }

    resolveCollision(m) {
        let cell = m.cell;
        let check = m.check;
        if (cell._size > check._size) {
            cell = m.check;
            check = m.cell;
        }
        // Do not resolve removed
        if (cell.isRemoved || check.isRemoved)
            return;

        // check eating distance
        check.div = this.config.mobilePhysics ? 20 : 3;
        if (m.d >= check._size - cell._size / check.div) {
            return; // too far => can't eat
        }

        // collision owned => ignore, resolve, or remerge
        if (cell.owner && cell.owner == check.owner) {
            if (cell.getAge() < 13 || check.getAge() < 13)
                return; // just splited => ignore
        } else if (check._size < cell._size * 1.15 || !check.canEat(cell))
            return; // Cannot eat or cell refuses to be eaten

        // Consume effect
        check.onEat(cell);
        cell.onEaten(check);
        cell.killedBy = check;

        // Remove cell
        this.removeNode(cell);
    }
    
    splitPlayerCell(player, parent, angle, mass) {
        let size = Math.sqrt(mass * 100);
        let size1 = Math.sqrt(parent.radius - size * size);

        // Too small to split
        if (!size1 || size1 < this.config.playerMinSize)
            return;

        // Remove size from parent cell
        parent.setSize(size1);

        // Create cell and add it to node list
        let newCell = new PlayerCell(this, player, parent.position, size);
        newCell.setBoost(this.config.splitVelocity * Math.pow(size, 0.0122), angle);
        this.addNode(newCell);
    }
    
    randomPos() {
        return new Vec2(
            this.border.minx + this.border.width * Math.random(),
            this.border.miny + this.border.height * Math.random()
        );
    }

    spawnCells() {
        // spawn food at random size
        let maxCount = this.config.foodMinAmount - this.nodesFood.length;
        let spawnCount = Math.min(maxCount, this.config.foodSpawnAmount);
        for (let i = 0; i < spawnCount; i++) {
            let cell = new Food(this, this.randomPos(), this.config.foodMinSize);
            if (this.config.foodMassGrow) {
                let maxGrow = this.config.foodMaxSize - cell._size;
                cell.setSize(cell._size += maxGrow * Math.random());
            }
            cell.color = this.getRandomColor();
            this.addNode(cell);
        }

        // spawn viruses (safely)
        if (this.nodesVirus.length < this.config.virusMinAmount) {
            let virus = new Virus(this, this.randomPos(), this.config.virusMinSize);
            if (!this.willCollide(virus)) this.addNode(virus);
        }
    }
    
    /**
     * 
     * @param {import("../ws-server/PlayerTracker")} player 
     * @param {Vec2} pos 
     */
    spawnPlayer(player, pos) {
        if (this.disableSpawn) return; // Not allowed to spawn!

        // Check for special starting size
        let size = this.config.playerStartSize;
        if (player.spawnmass) size = player.spawnmass;

        // Check if can spawn from ejected mass
        let index = ~~(this.nodesEjected.length * Math.random());
        let eject = this.nodesEjected[index]; // Randomly selected
        if (Math.random() <= this.config.ejectSpawnPercent &&
            eject && eject.boostDistance < 1) {
            // Spawn from ejected mass
            pos = eject.position.clone();
            player.color = eject.color;
            size = Math.max(size, eject._size * 1.15)
        }
        // Spawn player safely (do not check minions)
        let cell = new PlayerCell(this, player, pos, size);
        if (this.willCollide(cell) && !player.isMi)
            pos = this.randomPos(); // Not safe => retry
        this.addNode(cell);

        // Set initial mouse coords
        player.mouse = new Vec2(pos.x, pos.y);
    }

    /**
     * 
     * @param {import("../entity/Cell")} cell 
     */
    willCollide(cell) {
        let notSafe = false; // Safe by default
        let sqSize = cell.radius;
        let pos = this.randomPos();
        let d = cell.position.clone().sub(pos);
        if (d.dist() + sqSize <= sqSize * 2) {
            notSafe = true;
        }
        this.quadTree.find({
            minx: cell.position.x - cell._size,
            miny: cell.position.y - cell._size,
            maxx: cell.position.x + cell._size,
            maxy: cell.position.y + cell._size
        }, function (n) {
            if (n.cellType == 0) notSafe = true;
        });
        return notSafe;
    }

    splitCells(player) {
        // Split cell order decided by cell age
        let cellToSplit = [];
        for (let i = 0; i < player.cells.length; i++)
            cellToSplit.push(player.cells[i]);

        // Split split-able cells
        cellToSplit.forEach((cell) => {
            let d = player.mouse.clone().sub(cell.position);
            if (d.dist() < 1) {
                d.x = 1, d.y = 0;
            }

            if (cell._size < this.config.playerMinSplitSize)
                return; // cannot split

            // Get maximum cells for rec mode
            let max = player.rec ? 200 : this.config.playerMaxCells;
            if (player.cells.length >= max) return;

            // Now split player cells
            this.splitPlayerCell(player, cell, d.angle(), cell._mass * .5);
        });
    }

    canEjectMass(player) {
        if (player.lastEject === null) {
            // first eject
            player.lastEject = this.tickCounter;
            return true;
        }
        let dt = this.tickCounter - player.lastEject;
        if (dt < this.config.ejectCooldown) {
            // reject (cooldown)
            return false;
        }
        player.lastEject = this.tickCounter;
        return true;
    }
    
    ejectMass(player) {
        if (!this.canEjectMass(player) || player.frozen)
            return;
        for (let i = 0; i < player.cells.length; i++) {
            let cell = player.cells[i];

            if (cell._size < this.config.playerMinEjectSize)
                continue; // Too small to eject

            let d = player.mouse.clone().sub(cell.position);
            let sq = d.sqDist();
            d.x = sq > 1 ? d.x / sq : 1;
            d.y = sq > 1 ? d.y / sq : 0;

            // Remove mass from parent cell first
            let loss = this.config.ejectSizeLoss;
            loss = cell.radius - loss * loss;
            cell.setSize(Math.sqrt(loss));

            // Get starting position
            let pos = new Vec2(
                cell.position.x + d.x * cell._size,
                cell.position.y + d.y * cell._size
            );
            let angle = d.angle() + (Math.random() * .6) - .3;

            let ejected;
            // Create cell and add it to node list
            if (!this.config.ejectVirus) {
                ejected = new EjectedMass(this, pos, this.config.ejectSize);
            } else {
                ejected = new Virus(this, pos, this.config.ejectSize);
            }
            ejected.color = cell.color;
            ejected.setBoost(this.config.ejectVelocity, angle);
            this.addNode(ejected);
        }
    }
    
    shootVirus(parent, angle) {
        // Create virus and add it to node list
        let pos = parent.position.clone();
        let newVirus = new Virus(this, pos, this.config.virusMinSize);
        newVirus.setBoost(this.config.virusVelocity, angle);
        this.addNode(newVirus);
    }

    loadFiles() {
        // Load config
        let fs = require("fs");
        let fileNameConfig = this.srcFiles + '/gameserver.ini';
        let ini = require(this.srcFiles + '/modules/ini');
        try {
            if (!fs.existsSync(fileNameConfig)) {
                // No config
                Logger.warn("Config not found... Generating new config");
                // Create a new config
                fs.writeFileSync(fileNameConfig, ini.stringify(this.config), 'utf-8');
            } else {
                // Load the contents of the config file
                let load = ini.parse(fs.readFileSync(fileNameConfig, 'utf-8'));
                // Replace all the default config's values with the loaded config's values
                for (let key in load) {
                    if (this.config.hasOwnProperty(key)) this.config[key] = load[key];
                    else Logger.error("Unknown gameserver.ini value: " + key);
                }
            }
        } catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameConfig + ": " + err.message);
        }
        // Load bad words
        let fileNameBadWords = this.srcFiles + '/badwords.txt';
        try {
            if (!fs.existsSync(fileNameBadWords)) {
                Logger.warn(fileNameBadWords + " not found");
            } else {
                let words = fs.readFileSync(fileNameBadWords, 'utf-8');
                words = words.split(/[\r\n]+/);
                words = words.map(function (arg) {
                    return " " + arg.trim().toLowerCase() + " "; // Formatting
                });
                words = words.filter(function (arg) {
                    return arg.length > 2;
                });
                this.badWords = words;
                Logger.info(this.badWords.length + " bad words loaded");
            }
        } catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameBadWords + ": " + err.message);
        }

        // Load ip ban list
        let fileNameIpBan = this.srcFiles + '/ipbanlist.txt';
        try {
            if (fs.existsSync(fileNameIpBan)) {
                // Load and input the contents of the ipbanlist file
                this.ipBanList = fs.readFileSync(fileNameIpBan, "utf8").split(/[\r\n]+/).filter(function (x) {
                    return x != ''; // filter empty lines
                });
                Logger.info(this.ipBanList.length + " IP ban records loaded.");
            } else {
                Logger.warn(fileNameIpBan + " is missing.");
            }
        } catch (err) {
            Logger.error(err.stack);
            Logger.error("Failed to load " + fileNameIpBan + ": " + err.message);
        }

        // Convert config settings
        this.config.serverRestart = this.config.serverRestart === 0 ? 1e999 : this.config.serverRestart * 1500;
    }
    
    startStatsServer(port) {
        // Create stats
        this.stats = "Test";
        this.getStats();

        // // Show stats
        // this.httpServer = http.createServer(function (req, res) {
        //     res.setHeader('Access-Control-Allow-Origin', '*');
        //     res.writeHead(200);
        //     res.end(this.stats);
        // }.bind(this));
        // this.httpServer.on('error', function (err) {
        //     Logger.error("Stats Server: " + err.message);
        // });

        // let getStatsBind = this.getStats.bind(this);
        // this.httpServer.listen(port, function () {
        //     // Stats server
        //     Logger.info("Started stats server on port " + port);
        //     setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
        // }.bind(this));
    }
    
    getStats() {
        // Get server statistics
        let totalPlayers = 0;
        let alivePlayers = 0;
        let spectatePlayers = 0;
        for (let i = 0, len = this.player.length; i < len; i++) {
            let socket = this.player[i];
            if (!socket || !socket.isConnected || socket.playerTracker.isMi)
                continue;
            totalPlayers++;
            if (socket.playerTracker.cells.length) alivePlayers++;
            else spectatePlayers++;
        }
        let s = {
            'server_name': this.config.serverName,
            'server_chat': this.config.serverChat ? "true" : "false",
            'border_width': this.border.width,
            'border_height': this.border.height,
            'gamemode': this.gameMode.name,
            'max_players': this.config.serverMaxConnections,
            'current_players': totalPlayers,
            'alive': alivePlayers,
            'spectators': spectatePlayers,
            'update_time': this.updateTimeAvg.toFixed(3),
            'uptime': Math.round((this.stepDateTime - this.startTime) / 1000 / 60),
            'start_time': this.startTime
        };
        this.stats = JSON.stringify(s);
    }

    // Pings the server tracker, should be called every 30 seconds
    // To list us on the server tracker located at http://ogar.mivabe.nl/master
    pingServerTracker() {
    }
}
