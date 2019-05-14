// Imports Libraries
const GameMode = require('../gamemodes');
const Logger = require('./Logger');
const fs = require("fs");
const { MotherCell, Virus, PlayerCell, EjectedMass, Food } = require('../entity');
const HELP_MSG = fs.readFileSync(__dirname + "/cmd.txt", "utf-8");
const SHORTCUTS = fs.readFileSync(__dirname + "/shortcuts.txt", "utf-8");

// Utils
const fillChar = (data, char, fieldLength, rTL) => {
    let result = data.toString();
    if (rTL === true) {
        for (let i = result.length; i < fieldLength; i++)
            result = char.concat(result);
    } else {
        for (let i = result.length; i < fieldLength; i++)
            result = result.concat(char);
    }
    return result;
};


/**
 * @param {import("../GameServer")} gameServer 
 * @param {Number} id 
 */
const playerById = (id, gameServer) => {
    if (!id) return null;
    for (let i = 0; i < gameServer.clients.length; i++) {
        let playerTracker = gameServer.clients[i].playerTracker;
        if (playerTracker.pID == id) {
            return playerTracker;
        }
    }
    return null;
}

/**
 * @param {import("../GameServer")} gameServer 
 */
const saveIpBanList = gameServer => {
    let fs = require("fs");
    try {
        let blFile = fs.createWriteStream('../src/ipbanlist.txt');
        // Sort the blacklist and write.
        gameServer.ipBanList.sort().forEach(v => {
            blFile.write(v + '\n');
        });
        blFile.end();
        Logger.info(gameServer.ipBanList.length + " IP ban records saved.");
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to save " + '../src/ipbanlist.txt' + ": " + err.message);
    }
}

/**
 * @param {import("../GameServer")} gameServer 
 * @param {String[]} split 
 */
const ban = (gameServer, split, ip) => {
    let ipBin = ip.split('.');
    if (ipBin.length != 4) {
        Logger.warn("Invalid IP format: " + ip);
        return;
    }
    gameServer.ipBanList.push(ip);
    if (ipBin[2] == "*" || ipBin[3] == "*") {
        Logger.print("The IP sub-net " + ip + " has been banned");
    } else {
        Logger.print("The IP " + ip + " has been banned");
    }
    gameServer.clients.forEach(socket => {
        // If already disconnected or the ip does not match
        if (!socket || !socket.isConnected || !gameServer.checkIpBan(ip) || socket.remoteAddress != ip)
            return;
        // remove player cells
        Commands.kill(gameServer, split);
        // disconnect
        socket.close(null, "Banned from server");
        let name = getName(socket.playerTracker._name);
        Logger.print("Banned: \"" + name + "\" with Player ID " + socket.playerTracker.pID);
        gameServer.sendChatMessage(null, null, "Banned \"" + name + "\""); // notify to don't confuse with server bug
    }, gameServer);
    saveIpBanList(gameServer);
}

// functions from PlayerTracker

const getName = name => {
    if (!name.length)
        name = "An unnamed cell";
    return name.trim();
}

/**
 * @param {import("../ws-server/PlayerTracker")} client 
 */
const getScore = client => {
    let score = 0; // reset to not cause bugs
    for (let i = 0; i < client.cells.length; i++) {
        if (!client.cells[i]) continue;
        score += client.cells[i]._mass;
    }
    return score;
};

/**
 * @param {import("../ws-server/PlayerTracker")} client 
 */
const getPos = client => {
    for (let i = 0; i < client.cells.length; i++) {
        if (!client.cells[i]) continue;
        return {
            x: client.cells[i].position.x / client.cells.length,
            y: client.cells[i].position.y / client.cells.length
        }
    }
}

// functions from QuadNode

/**
 * @param {import("./QuadNode")} quad 
 */
const scanNodeCount = quad => {
    let count = 0;
    for (let i = 0; i < quad.childNodes.length; i++) {
        count += scanNodeCount(quad.childNodes[i]);
    }
    return 1 + count;
};

/**
 * @param {import("./QuadNode")} quad 
 */
const scanItemCount = quad => {
    let count = 0;
    for (let i = 0; i < quad.childNodes.length; i++) {
        count += scanItemCount(quad.childNodes[i]);
    }
    return quad.items.length + count;
};

// Commands
module.exports = class Commands {

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static help(gameServer, split) {
        Logger.print(HELP_MSG);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static shortcuts(gameServer, split) {
        Logger.print(SHORTCUTS);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static chat(gameServer, split) {
        for (let i = 0; i < gameServer.clients.length; i++) {
            gameServer.sendChatMessage(null, i, String(split.slice(1, split.length).join(" ")));
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static debug(gameServer, split) {
        // Count client cells
        let clientCells = 0;
        for (let i in gameServer.clients) {
            clientCells += gameServer.clients[i].playerTracker.cells.length;
        }
        // Output node information
        Logger.print("Clients:        " + fillChar(gameServer.clients.length, " ", 4, true) + " / " + gameServer.config.serverMaxConnections + " + bots" + "\n" +
            "Total nodes:" + fillChar(gameServer.nodes.length, " ", 8, true) + "\n" +
            "- Client cells: " + fillChar(clientCells, " ", 4, true) + " / " + (gameServer.clients.length * gameServer.config.playerMaxCells) + "\n" +
            "- Ejected cells:" + fillChar(gameServer.nodesEjected.length, " ", 4, true) + "\n" +
            "- Food:        " + fillChar(gameServer.nodesFood.length, " ", 4, true) + " / " + gameServer.config.foodMaxAmount + "\n" +
            "- Viruses:      " + fillChar(gameServer.nodesVirus.length, " ", 4, true) + " / " + gameServer.config.virusMaxAmount + "\n" +
            "Moving nodes:   " + fillChar(gameServer.movingNodes.length, " ", 4, true) + "\n" +
            "Quad nodes:     " + fillChar(scanNodeCount(gameServer.quadTree), " ", 4, true) + "\n" +
            "Quad items:     " + fillChar(scanItemCount(gameServer.quadTree), " ", 4, true));
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static reset(gameServer, split) {
        let ent = split[1];
        if (ent != "ejected" && ent != "food" && ent != "virus") {
            Logger.warn("Removed " + gameServer.nodes.length + " nodes");
            for (; gameServer.nodes.length;) gameServer.removeNode(gameServer.nodes[0]);
        }
        if (ent == "ejected") {
            Logger.print("Removed " + gameServer.nodesEjected.length + " ejected nodes");
            for (; gameServer.nodesEjected.length;) gameServer.removeNode(gameServer.nodesEjected[0]);
        }
        if (ent == "food") {
            Logger.print("Removed " + gameServer.nodesFood.length + " food nodes");
            for (; gameServer.nodesFood.length;) gameServer.removeNode(gameServer.nodesFood[0]);
        }
        if (ent == "virus") {
            Logger.print("Removed " + gameServer.nodesVirus.length + " virus nodes");
            for (; gameServer.nodesVirus.length;) gameServer.removeNode(gameServer.nodesVirus[0]);
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static minion(gameServer, split) {
        let id = parseInt(split[1]);
        let add = parseInt(split[2]);
        let name = split.slice(3, split.length).join(' ');

        // Error! ID is NaN
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player id!");
            return;
        }

        // Find ID specified and add/remove minions for them
        for (let i in gameServer.clients) {
            let client = gameServer.clients[i].playerTracker;

            if (client.pID == id) {

                // Prevent the user from giving minions, to minions
                if (client.isMi) {
                    Logger.warn("You cannot give minions to a minion!");
                    return;
                };

                // Remove minions
                if (client.minionControl === true && isNaN(add)) {
                    client.minionControl = false;
                    client.miQ = 0;
                    Logger.print("Successfully removed minions for " + getName(client._name));
                    // Add minions
                } else {
                    client.minionControl = true;
                    // Add minions for client
                    if (isNaN(add)) add = 1;
                    for (let i = 0; i < add; i++) {
                        gameServer.bots.addMinion(client, name);
                    }
                    Logger.print("Added " + add + " minions for " + getName(client._name));
                }
                break;
            }
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static addbot(gameServer, split) {
        let add = parseInt(split[1]);
        if (isNaN(add)) {
            add = 1; // Adds 1 bot if user doesnt specify a number
        }

        for (let i = 0; i < add; i++) {
            gameServer.bots.addBot();
        }
        Logger.print("Added " + add + " player bots");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static ban(gameServer, split) {
        // Error message
        let logInvalid = "Please specify a valid player ID or IP address!";

        if (split[1] === null || typeof split[1] == "undefined") {
            // If no input is given; added to avoid error
            Logger.warn(logInvalid);
            return;
        }

        if (split[1].indexOf(".") >= 0) {
            // If input is an IP address
            let ip = split[1];
            let ipParts = ip.split(".");

            // Check for invalid decimal numbers of the IP address
            for (let i in ipParts) {
                if (i > 1 && ipParts[i] == "*") {
                    // mask for sub-net
                    continue;
                }
                // If not numerical or if it's not between 0 and 255
                if (isNaN(ipParts[i]) || ipParts[i] < 0 || ipParts[i] >= 256) {
                    Logger.warn(logInvalid);
                    return;
                }
            }
            ban(gameServer, split, ip);
            return;
        }
        // if input is a Player ID
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            // If not numerical
            Logger.warn(logInvalid);
            return;
        }
        let ip = null;
        for (let i in gameServer.clients) {
            let client = gameServer.clients[i];
            if (!client || !client.isConnected)
                continue;
            if (client.playerTracker.pID == id) {
                ip = client._socket.remoteAddress;
                break;
            }
        }
        if (ip) ban(gameServer, split, ip);
        else Logger.warn("Player ID " + id + " not found!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static banlist(gameServer, split) {
        Logger.print("Showing " + gameServer.ipBanList.length + " banned IPs: ");
        Logger.print(" IP              | IP ");
        Logger.print("───────────────────────────────────");

        for (let i = 0; i < gameServer.ipBanList.length; i += 2) {
            Logger.print(" " + fillChar(gameServer.ipBanList[i], " ", 15) + " | " +
                (gameServer.ipBanList.length === i + 1 ? "" : gameServer.ipBanList[i + 1])
            );
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static kickbot(gameServer, split) {
        let toRemove = parseInt(split[1]);
        if (isNaN(toRemove)) {
            // Kick all bots if user doesnt specify a number
            toRemove = gameServer.clients.length;
        }
        let removed = 0;
        for (let i = 0; i < gameServer.clients.length; i++) {
            if (gameServer.clients[i].isConnected != null)
                continue; // verify that the client is a bot
            gameServer.clients[i].close();
            removed++;
            if (removed >= toRemove)
                break;
        }
        if (!removed)
            Logger.warn("Cannot find any bots");
        else if (toRemove == removed)
            Logger.warn("Kicked " + removed + " bots");
        else
            Logger.warn("Only " + removed + " bots were kicked");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static board(gameServer, split) {
        let newLB = [];
        let reset = split[1];

        for (let i = 1; i < split.length; i++) {
            if (split[i]) newLB[i - 1] = split[i];
            else newLB[i - 1] = " ";
        }

        // Clears the update leaderboard function and replaces it with our own
        gameServer.gameMode.packetLB = 48;
        gameServer.gameMode.specByLeaderboard = false;
        gameServer.gameMode.updateLB = function (gameServer) {
            gameServer.leaderboard = newLB;
            gameServer.leaderboardType = 48;
        };
        if (reset != "reset") {
            Logger.print("Successfully changed leaderboard values");
            Logger.print('Do "board reset" to reset leaderboard');
        } else {
            // Gets the current gamemode
            let gm = GameMode.get(gameServer.gameMode.ID);

            // Replace functions
            gameServer.gameMode.packetLB = gm.packetLB;
            gameServer.gameMode.updateLB = gm.updateLB;
            Logger.print("Successfully reset leaderboard");
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static change(gameServer, split) {
        if (split.length < 3) {
            Logger.warn("Invalid command arguments");
            return;
        }
        let key = split[1];
        let value = split[2];

        // Check if int/float
        if (value.indexOf('.') != -1) {
            value = parseFloat(value);
        } else {
            value = parseInt(value);
        }

        if (value == null || isNaN(value)) {
            Logger.warn("Invalid value: " + value);
            return;
        }
        if (!gameServer.config.hasOwnProperty(key)) {
            Logger.warn("Unknown config value: " + key);
            return;
        }
        gameServer.config[key] = value;

        // update/validate
        gameServer.config.playerMinSize = Math.max(32, gameServer.config.playerMinSize);
        Logger.setVerbosity(gameServer.config.logVerbosity);
        Logger.setFileVerbosity(gameServer.config.logFileVerbosity);
        Logger.print("Set " + key + " = " + gameServer.config[key]);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     */
    static clear(gameServer) {
        Logger.info("Version " + gameServer.version);
        Logger.info("Listening on port " + gameServer.config.serverPort);
        Logger.info("Current game mode is " + gameServer.gameMode.name + "\n");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static color(gameServer, split) {
        // Validation checks
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        // Get colors
        let color = {
            r: 0,
            g: 0,
            b: 0
        };
        color.r = Math.max(Math.min(parseInt(split[2]), 255), 0);
        color.g = Math.max(Math.min(parseInt(split[3]), 255), 0);
        color.b = Math.max(Math.min(parseInt(split[4]), 255), 0);

        // Sets color to the specified amount
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                client.color = color; // Set color
                for (let j in client.cells) {
                    client.cells[j].color = color;
                }
                break;
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
        Logger.print("Changed " + getName(client._name) + "'s color to: " + color.r + ", " + color.g + ", " + color.b);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static exit(gameServer, split) {
        Logger.warn("Closing server...");
        gameServer.wsServer.close();
        process.exit(0);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     */
    static restart(gameServer) {
        let QuadNode = require('./QuadNode.js.js');
        Logger.warn("Restarting server...");
        gameServer.httpServer = null;
        gameServer.wsServer = null;
        gameServer.run = true;
        gameServer.lastNodeId = 1;
        gameServer.lastPlayerId = 1;

        for (let i = 0; i < gameServer.clients.length; i++) {
            let client = gameServer.clients[i];
            client.close();
        };

        gameServer.nodes = [];
        gameServer.nodesVirus = [];
        gameServer.nodesFood = [];
        gameServer.nodesEjected = [];
        gameServer.nodesPlayer = [];
        gameServer.movingNodes = [];
        gameServer.commands;
        gameServer.tickCounter = 0;
        gameServer.startTime = Date.now();
        gameServer.setBorder(gameServer.config.borderWidth, gameServer.config.borderHeight);
        gameServer.quadTree = new QuadNode(gameServer.border, 64, 32);

    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static kick(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        // kick player
        let count = 0;
        gameServer.clients.forEach(function (socket) {
            if (socket.isConnected === false)
                return;
            if (id !== 0 && socket.playerTracker.pID != id)
                return;
            // remove player cells
            Commands.kill(gameServer, split);
            // disconnect
            socket.close(1000, "Kicked from server");
            let name = getName(socket.playerTracker._name);
            Logger.print("Kicked \"" + name + "\"");
            gameServer.sendChatMessage(null, null, "Kicked \"" + name + "\""); // notify to don't confuse with server bug
            count++;
        }, this);
        if (count) return;
        if (!id) Logger.warn("No players to kick!");
        else Logger.warn("That player ID (" + id + ") is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static mute(gameServer, args) {
        if (!args || args.length < 2) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let id = parseInt(args[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let player = playerById(id, gameServer);
        if (!player) {
            Logger.warn("That player ID (" + id + ") is non-existant!");
            return;
        }
        if (player.isMuted) {
            Logger.warn("That player with ID (" + id + ") is already muted!");
            return;
        }
        Logger.print("Player \"" + getName(player._name) + "\" was muted");
        player.isMuted = true;
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static unmute(gameServer, args) {
        if (!args || args.length < 2) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let id = parseInt(args[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let player = playerById(id, gameServer);
        if (player === null) {
            Logger.warn("That player ID (" + id + ") is non-existant!");
            return;
        }
        if (!player.isMuted) {
            Logger.warn("Player with id=" + id + " already not muted!");
            return;
        }
        Logger.print("Player \"" + getName(player._name) + "\" was unmuted");
        player.isMuted = false;
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static kickall(gameServer, split) {
        this.id = 0; //kick ALL players
        // kick player
        let count = 0;
        gameServer.clients.forEach(function (socket) {
            if (socket.isConnected === false)
                return;
            if (this.id != 0 && socket.playerTracker.pID != this.id)
                return;
            // remove player cells
            Commands.killall(gameServer, split);
            // disconnect
            socket.close(1000, "Kicked from server.");
            let name = getName(socket.playerTracker._name);
            Logger.print("Kicked \"" + name + "\"");
            gameServer.sendChatMessage(null, null, "Kicked \"" + name + "\""); // notify to don't confuse with server bug
            count++;
        }, this);

        if (count) return;
        if (!this.id) Logger.warn("No players to kick!");
        else Logger.warn("That player ID (" + this.id + ") is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static kill(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        let count = 0;
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                let len = client.cells.length;
                for (let j = 0; j < len; j++) {
                    gameServer.removeNode(client.cells[0]);
                    count++;
                }

                Logger.print("Killed " + getName(client._name) + " and removed " + count + " cells");
                break;
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static killall(gameServer, split) {
        let count = 0;
        for (let i = 0; i < gameServer.clients.length; i++) {
            let playerTracker = gameServer.clients[i].playerTracker;
            while (playerTracker.cells.length > 0) {
                gameServer.removeNode(playerTracker.cells[0]);
                count++;
            }
        }
        if (this.id) Logger.print("Removed " + count + " cells");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static mass(gameServer, split) {
        // Validation checks
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let amount = parseInt(split[2]);
        if (isNaN(amount)) {
            Logger.warn("Please specify a valid number");
            return;
        }
        let size = Math.sqrt(amount * 100);

        // Sets mass to the specified amount
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                for (let j in client.cells) {
                    client.cells[j].setSize(size);
                }
                Logger.print("Set mass of " + getName(client._name) + " to " + (size * size / 100).toFixed(3));
                break;
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static spawnmass(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        let amount = Math.max(parseInt(split[2]), 9);
        let size = Math.sqrt(amount * 100);
        if (isNaN(amount)) {
            Logger.warn("Please specify a valid mass!");
            return;
        }

        // Sets spawnmass to the specified amount
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                client.spawnmass = size;
                Logger.print("Set spawnmass of " + getName(client._name) + " to " + (size * size / 100).toFixed(3));
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static speed(gameServer, split) {
        let id = parseInt(split[1]);
        let speed = parseInt(split[2]);
        if (isNaN(id)) {
            Logger.print("Please specify a valid player ID!");
            return;
        }

        if (isNaN(speed)) {
            Logger.print("Please specify a valid speed!");
            return;
        }

        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                client.customspeed = speed;
                // override getSpeed function from PlayerCell
                PlayerCell.prototype.getSpeed = function (dist) {
                    let speed = 2.2 * Math.pow(this._size, -0.439);
                    speed = this.owner.customspeed ?
                        speed * 40 * this.owner.customspeed : // Set by command
                        speed * 40 * this.gameServer.config.playerSpeed;
                    return Math.min(dist, speed) / dist;
                };
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
        Logger.print("Set base speed of " + getName(client._name) + " to " + speed);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static merge(gameServer, split) {
        // Validation checks
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        // Find client with same ID as player entered
        for (let i = 0; i < gameServer.clients.length; i++) {
            if (id == gameServer.clients[i].playerTracker.pID) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                if (client.cells.length == 1) return Logger.warn("Client already has one cell!");
                // Set client's merge override
                client.mergeOverride = !client.mergeOverride;
                if (client.mergeOverride) Logger.print(getName(client._name) + " is now force merging");
                else Logger.print(getName(client._name) + " isn't force merging anymore");
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static rec(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        // set rec for client
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                client.rec = !client.rec;
                if (client.rec) Logger.print(getName(client._name) + " is now in rec mode!");
                else Logger.print(getName(client._name) + " is no longer in rec mode");
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static split(gameServer, split) {
        let id = parseInt(split[1]);
        let count = parseInt(split[2]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        if (isNaN(count)) {
            Logger.print("Split player 4 times");
            count = 4;
        }
        if (count > gameServer.config.playerMaxCells) {
            Logger.print("Split player to playerMaxCells");
            count = gameServer.config.playerMaxCells;
        }
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                for (let i = 0; i < count; i++) {
                    gameServer.splitCells(client);
                }
                Logger.print("Forced " + getName(client._name) + " to split " + count + " times");
                break;
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static name(gameServer, split) {
        // Validation checks
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        let name = split.slice(2, split.length).join(' ');
        if (typeof name == 'undefined') {
            Logger.warn("Please type a valid name");
            return;
        }

        // Change name
        for (let i = 0; i < gameServer.clients.length; i++) {
            let client = gameServer.clients[i].playerTracker;
            if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
            if (client.pID == id) {
                Logger.print("Changing " + getName(client._name) + " to " + name);
                client.setName(name);
                return;
            }
        }

        // Error
        Logger.warn("That player ID (" + id + ") is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static skin(gameServer, args) {
        if (!args || args.length < 3) {
            Logger.warn("Please specify a valid player ID and skin name!");
            return;
        }
        let id = parseInt(args[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let skin = args[2].trim();
        if (!skin) {
            Logger.warn("Please specify skin name!");
        }
        let player = playerById(id, gameServer);
        if (!player) {
            Logger.warn("That player ID (" + id + ") is non-existant!");
            return;
        }
        if (player.cells.length) {
            Logger.warn("Player is alive, skin will not be applied to existing cells!");
        }
        Logger.print("Player \"" + getName(player._name) + "\"'s skin is changed to " + skin);
        player.setSkin(skin);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static unban(gameServer, split) {
        if (split.length < 2 || !split[1] || split[1].trim().length < 1) {
            Logger.warn("Please specify a valid IP!");
            return;
        }
        let ip = split[1].trim();
        let index = gameServer.ipBanList.indexOf(ip);
        if (index < 0) {
            Logger.warn("IP " + ip + " is not in the ban list!");
            return;
        }
        gameServer.ipBanList.splice(index, 1);
        saveIpBanList(gameServer);
        Logger.print("Unbanned IP: " + ip);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static playerlist(gameServer, split) {
        if (!gameServer.clients.length) return Logger.warn("No bots or players are currently connected to the server!");
        Logger.print("\nCurrent players: " + gameServer.clients.length);
        Logger.print('Do "playerlist m" or "pl m" to list minions\n');
        Logger.print(" ID     | IP              | P | CELLS | SCORE  |   POSITION   | " + fillChar('NICK', ' ', gameServer.config.playerMaxNickLength) + " "); // Fill space
        Logger.print(fillChar('', '─', ' ID     | IP              | CELLS | SCORE  |   POSITION   |   |  '.length + gameServer.config.playerMaxNickLength));
        let sockets = gameServer.clients.slice(0);
        sockets.sort(function (a, b) {
            return a.playerTracker.pID - b.playerTracker.pID;
        });
        for (let i = 0; i < sockets.length; i++) {
            let socket = sockets[i];
            let client = socket.playerTracker;
            let type = split[1];

            // ID with 3 digits length
            let id = fillChar((client.pID), ' ', 6, true);

            // Get ip (15 digits length)
            let ip = client.isMi ? "[MINION]" : "[BOT]";
            if (socket.isConnected && !client.isMi) {
                ip = socket.remoteAddress;
            } else if (client.isMi && type != "m") {
                continue; // do not list minions
            }
            ip = fillChar(ip, ' ', 15);

            // Get name and data
            let protocol = gameServer.clients[i].packetHandler.protocol;
            if (!protocol) protocol = "?";
            let nick = '',
                cells = '',
                score = '',
                position = '',
                data = '';
            if (socket.closeReason != null) {
                // Disconnected
                let reason = "[DISCONNECTED] ";
                if (socket.closeReason.code)
                    reason += "[" + socket.closeReason.code + "] ";
                if (socket.closeReason.message)
                    reason += socket.closeReason.message;
                Logger.print(" " + id + " | " + ip + " | " + protocol + " | " + reason);
            } else if (!socket.packetHandler.protocol && socket.isConnected && !client.isMi) {
                Logger.print(" " + id + " | " + ip + " | " + protocol + " | " + "[CONNECTING]");
            } else if (client.spectate) {
                nick = "in free-roam";
                if (!client.freeRoam) {
                    let target = client.getSpecTarget();
                    if (target) nick = getName(target._name);
                }
                data = fillChar("SPECTATING: " + nick, '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                Logger.print(" " + id + " | " + ip + " | " + protocol + " | " + data);
            } else if (client.cells.length) {
                nick = fillChar(getName(client._name), ' ', gameServer.config.playerMaxNickLength);
                cells = fillChar(client.cells.length, ' ', 5, true);
                score = fillChar(getScore(client) >> 0, ' ', 6, true);
                position = fillChar(getPos(client).x >> 0, ' ', 5, true) + ', ' + fillChar(getPos(client).y >> 0, ' ', 5, true);
                Logger.print(" " + id + " | " + ip + " | " + protocol + " | " + cells + " | " + score + " | " + position + " | " + nick);
            } else {
                // No cells = dead player or in-menu
                data = fillChar('DEAD OR NOT PLAYING', '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                Logger.print(" " + id + " | " + ip + " | " + protocol + " | " + data);
            }
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static pause(gameServer, split) {
        gameServer.run = !gameServer.run; // Switches the pause state
        let s = gameServer.run ? "Unpaused" : "Paused";
        Logger.print(s + " the game.");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static freeze(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.print("Please specify a valid player ID!");
            return;
        }

        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                // set frozen state
                client.frozen = !client.frozen;
                if (client.frozen) Logger.print("Froze " + getName(client._name));
                else Logger.print("Unfroze " + getName(client._name));
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static reload(gameServer, split) {
        gameServer.loadFiles();
        Logger.print("Reloaded files successfully");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static status(gameServer, split) {
        let ini = require('./ini.js.js');
        // Get amount of humans/bots
        let humans = 0,
            bots = 0;
        for (let i = 0; i < gameServer.clients.length; i++) {
            if ('_socket' in gameServer.clients[i])
                humans++;
            else
                bots++;
        }

        // Get average score of all players
        let scores = [];
        for (let i in gameServer.clients)
            scores.push(getScore(gameServer.clients[i].playerTracker))
        if (!gameServer.clients.length) scores = [0];

        Logger.print("Connected players: " + gameServer.clients.length + "/" + gameServer.config.serverMaxConnections);
        Logger.print("Players: " + humans + " - Bots: " + bots);
        Logger.print("Average score: " + (scores.reduce(function (x, y) {
            return x + y;
        }) / scores.length).toFixed(2));
        Logger.print("Server has been running for a total of" + Math.floor(process.uptime() / 60) + " minutes");
        Logger.print("Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10 + " mb");
        Logger.print("Current game mode: " + gameServer.gameMode.name);
        Logger.print("Current update time: " + gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(gameServer.updateTimeAvg) + ")");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static tp(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }

        // Make sure the input values are numbers
        let pos = {
            x: parseInt(split[2]),
            y: parseInt(split[3])
        };
        if (isNaN(pos.x) || isNaN(pos.y)) {
            Logger.warn("Invalid coordinates");
            return;
        }

        // Spawn
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                for (let j in client.cells) {
                    client.cells[j].position.x = pos.x;
                    client.cells[j].position.y = pos.y;
                    gameServer.updateNodeQuad(client.cells[j]);
                }
                Logger.print("Teleported " + getName(client._name) + " to (" + pos.x + " , " + pos.y + ")");
                break;
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static spawn(gameServer, split) {
        let ent = split[1];
        if (ent != "virus" && ent != "food" && ent != "mothercell") {
            Logger.warn("Please specify either virus, food, or mothercell");
            return;
        }

        let pos = {
            x: parseInt(split[2]),
            y: parseInt(split[3])
        };
        let mass = parseInt(split[4]);

        // Make sure the input values are numbers
        if (isNaN(pos.x) || isNaN(pos.y)) {
            Logger.warn("Invalid coordinates");
            return;
        }

        // Start size for each entity
        if (ent == "virus") {
            let size = gameServer.config.virusMinSize;
        } else if (ent == "mothercell") {
            size = gameServer.config.virusMinSize * 2.5;
        } else if (ent == "food") {
            size = gameServer.config.foodMinMass;
        }

        if (!isNaN(mass)) {
            size = Math.sqrt(mass * 100);
        }

        // Spawn for each entity
        if (ent == "virus") {
            let virus = new Virus(gameServer, pos, size);
            gameServer.addNode(virus);
            Logger.print("Spawned 1 virus at (" + pos.x + " , " + pos.y + ")");
        } else if (ent == "food") {
            let food = new Food(gameServer, pos, size);
            food.color = gameServer.getRandomColor();
            gameServer.addNode(food);
            Logger.print("Spawned 1 food cell at (" + pos.x + " , " + pos.y + ")");
        } else if (ent == "mothercell") {
            let mother = new MotherCell(gameServer, pos, size);
            gameServer.addNode(mother);
            Logger.print("Spawned 1 mothercell at (" + pos.x + " , " + pos.y + ")");
        }
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static replace(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        let ent = split[2];
        if (ent != "virus" && ent != "food" && ent != "mothercell") {
            Logger.warn("Please specify either virus, food, or mothercell");
            return;
        }
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                while (client.cells.length > 0) {
                    let cell = client.cells[0];
                    gameServer.removeNode(cell);
                    // replace player with entity
                    if (ent == "virus") {
                        let virus = new Virus(gameServer, cell.position, cell._size);
                        gameServer.addNode(virus);
                    } else if (ent == "food") {
                        let food = new Food(gameServer, cell.position, cell._size);
                        food.color = gameServer.getRandomColor();
                        gameServer.addNode(food);
                    } else if (ent == "mothercell") {
                        let mother = new MotherCell(gameServer, cell.position, cell._size);
                        gameServer.addNode(mother);
                    }
                }
            }
        }
        if (ent == "virus") {
            Logger.print("Replaced " + getName(client._name) + " with a virus");
        } else if (ent == "food") {
            Logger.print("Replaced " + getName(client._name) + " with a food cell");
        } else if (ent == "mothercell") {
            Logger.print("Replaced " + getName(client._name) + " with a mothercell");
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static pop(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                let virus = new Virus(gameServer, client.centerPos, gameServer.config.virusMinSize);
                gameServer.addNode(virus);
                Logger.print("Popped " + getName(client._name));
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static explode(gameServer, split) {
        let id = parseInt(split[1]);
        if (isNaN(id)) {
            Logger.warn("Please specify a valid player ID!");
            return;
        }
        for (let i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.pID == id) {
                let client = gameServer.clients[i].playerTracker;
                for (let i = 0; i < client.cells.length; i++) {
                    let cell = client.cells[i];
                    while (cell._size > gameServer.config.playerMinSize) {
                        // remove mass from parent cell
                        let angle = 6.28 * Math.random();
                        let loss = gameServer.config.ejectSizeLoss;
                        let size = cell.radius - loss * loss;
                        cell.setSize(Math.sqrt(size));
                        // explode the cell
                        let pos = {
                            x: cell.position.x + angle,
                            y: cell.position.y + angle
                        };
                        let ejected = new EjectedMass(gameServer, pos, gameServer.config.ejectSize);
                        ejected.color = cell.color;
                        ejected.setBoost(gameServer.config.ejectVelocity * Math.random(), angle);
                        gameServer.addNode(ejected);
                    }
                    cell.setSize(gameServer.config.playerMinSize);
                }
                if (!client.cells.length) return Logger.warn("That player is either dead or not playing!");
                Logger.print("Successfully exploded " + getName(client._name));
            }
        }
        if (client == null) return void Logger.warn("That player ID is non-existant!");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static lms(gameServer, split) {
        gameServer.disableSpawn = !gameServer.disableSpawn;
        let s = gameServer.disableSpawn ? "Started" : "Ended";
        Logger.print(s + " last man standing");
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static calc(gameServer, split) {
        let num = parseInt(split[1]);
        if (isNaN(num)) {
            Logger.warn("Please specify a valid number!");
            return;
        }
        let to = split[2];
        if (to != "toMass" && to != "toSize") {
            Logger.warn('Please specify either "toMass" or "toSize"');
            return;
        }
        if (to == "toMass") Logger.print("The specified size is " + num * num / 100 + " in mass");
        else Logger.print("The specified mass is " + (Math.sqrt(num * 100)).toFixed(2) + " in size");
    }

    // Aliases for commands

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static st(gameServer, split) { // Status
        Commands.status(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    pl(gameServer, split) { // Playerlist
        Commands.playerlist(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static m(gameServer, split) { // Mass
        Commands.mass(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static mn(gameServer, split) { 
        // Minion
        Commands.minion(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static sm(gameServer, split) {
        // Spawnmass
        Commands.spawnmass(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static ka(gameServer, split) { 
        // Killall
        Commands.killall(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static k(gameServer, split) { 
        // Kill
        Commands.kill(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static mg(gameServer, split) { // Merge
        Commands.merge(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static s(gameServer, split) { // Speed
        Commands.speed(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static f(gameServer, split) {
        // Freeze
        Commands.freeze(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static ab(gameServer, split) { // Addbot
        Commands.addbot(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static kb(gameServer, split) { // Kickbot
        Commands.kickbot(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    c(gameServer, split) { 
        // Change
        Commands.change(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static n(gameServer, split) { 
        // Name
        Commands.name(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static rep(gameServer, split) {
        Commands.replace(gameServer, split);
    }

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {String[]} split 
     */
    static e(gameServer, split) {
        Commands.explode(gameServer, split);
    }
}