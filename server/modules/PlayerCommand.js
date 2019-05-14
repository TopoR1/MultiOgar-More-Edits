const Logger = require('./Logger');
const UserRoleEnum = {};

const playerCommands = {
    help: function (args) {
        if (this.playerTracker.userRole == UserRoleEnum.MODER) {
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            this.writeLine("/skin %shark - change skin");
            this.writeLine("/kill - self kill");
            this.writeLine("/killall - kills everyone.")
            this.writeLine("/help - this command list");
            this.writeLine("/id - Gets your playerID");
            this.writeLine("/mass - gives mass to yourself or to other player");
            this.writeLine("/minion - gives yourself or other player minions");
            this.writeLine("/minion remove - removes all of your minions or other players minions");
            this.writeLine("/status - Shows Status of the Server");
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        }
        if (this.playerTracker.userRole == UserRoleEnum.ADMIN) {
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            this.writeLine("/skin %shark - change skin");
            this.writeLine("/kill - self kill");
            this.writeLine("/killall - kills everyone.")
            this.writeLine("/help - this command list");
            this.writeLine("/id - Gets your playerID");
            this.writeLine("/mass - gives mass to yourself or to other player");
            this.writeLine("/spawnmass - gives yourself or other player spawnmass");
            this.writeLine("/minion - gives yourself or other player minions");
            this.writeLine("/minion remove - removes all of your minions or other players minions");
            this.writeLine("/addbot - Adds AI Bots to the Server");
            this.writeLine("/shutdown - SHUTDOWNS THE SERVER");
            this.writeLine("/status - Shows Status of the Server");
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        } else {
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            this.writeLine("/skin %shark - change skin");
            this.writeLine("/kill - self kill");
            this.writeLine("/help - this command list");
            this.writeLine("/id - Gets your playerID");
            this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        }
    },
    id: function (args) {
        this.writeLine("Your PlayerID is " + this.playerTracker.pID);
    },
    skin: function (args) {
        if (this.playerTracker.cells.length) {
            this.writeLine("ERROR: Cannot change skin while player in game!");
            return;
        }
        let skinName = "";
        if (args[1]) skinName = args[1];
        this.playerTracker.setSkin(skinName);
        if (skinName == "")
            this.writeLine("Your skin was removed");
        else
            this.writeLine("Your skin set to " + skinName);
    },
    kill: function (args) {
        if (!this.playerTracker.cells.length) {
            this.writeLine("You cannot kill yourself, because you're still not joined to the game!");
            return;
        }
        while (this.playerTracker.cells.length) {
            let cell = this.playerTracker.cells[0];
            this.gameServer.removeNode(cell);
            // replace with food
            let food = require('../entity/Food');
            food = new food(this.gameServer, cell.position, cell._size);
            food.color = cell.color;
            this.gameServer.addNode(food);
        }
        this.writeLine("You killed yourself");
    },

    killall: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        let count = 0;
        let cell = this.playerTracker.cells[0];
        for (let i = 0; i < this.gameServer.clients.length; i++) {
            let playerTracker = this.gameServer.clients[i].playerTracker;
            while (playerTracker.cells.length > 0) {
                this.gameServer.removeNode(playerTracker.cells[0]);
                count++;
            }
        }
        this.writeLine("You killed everyone. (" + count + (" cells.)"));
    },

    mass: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        let mass = parseInt(args[1]);
        let id = parseInt(args[2]);
        let size = Math.sqrt(mass * 100);

        if (isNaN(mass)) {
            this.writeLine("ERROR: missing mass argument!");
            return;
        }

        if (isNaN(id)) {
            this.writeLine("Warn: missing ID arguments. This will change your mass.");
            for (let i in this.playerTracker.cells) {
                this.playerTracker.cells[i].setSize(size);
            }
            this.writeLine("Set mass of " + this.playerTracker._name + " to " + size * size / 100);
        } else {
            for (let i in this.gameServer.clients) {
                let client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {
                    for (let j in client.cells) {
                        client.cells[j].setSize(size);
                    }
                    this.writeLine("Set mass of " + client._name + " to " + size * size / 100);
                    let text = this.playerTracker._name + " changed your mass to " + size * size / 100;
                    this.gameServer.sendChatMessage(null, client, text);
                    break;
                }
            }
        }

    },
    spawnmass: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        let mass = parseInt(args[1]);
        let id = parseInt(args[2]);
        let size = Math.sqrt(mass * 100);

        if (isNaN(mass)) {
            this.writeLine("ERROR: missing mass argument!");
            return;
        }

        if (isNaN(id)) {
            this.playerTracker.spawnmass = size;
            this.writeLine("Warn: missing ID arguments. This will change your spawnmass.");
            this.writeLine("Set spawnmass of " + this.playerTracker._name + " to " + size * size / 100);
        } else {
            for (let i in this.gameServer.clients) {
                let client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {
                    client.spawnmass = size;
                    this.writeLine("Set spawnmass of " + client._name + " to " + size * size / 100);
                    let text = this.playerTracker._name + " changed your spawn mass to " + size * size / 100;
                    this.gameServer.sendChatMessage(null, client, text);
                }
            }
        }
    },
    minion: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        let add = args[1];
        let id = parseInt(args[2]);
        let player = this.playerTracker;

        /** For you **/
        if (isNaN(id)) {
            this.writeLine("Warn: missing ID arguments. This will give you minions.");
            // Remove minions
            if (player.minionControl == true && add == "remove") {
                player.minionControl = false;
                player.miQ = 0;
                this.writeLine("Succesfully removed minions for " + player._name);
                // Add minions
            } else {
                player.minionControl = true;
                // Add minions for self
                if (isNaN(parseInt(add))) add = 1;
                for (let i = 0; i < add; i++) {
                    this.gameServer.bots.addMinion(player);
                }
                this.writeLine("Added " + add + " minions for " + player._name);
            }

        } else {
            /** For others **/
            for (let i in this.gameServer.clients) {
                let client = this.gameServer.clients[i].playerTracker;
                if (client.pID == id) {

                    // Prevent the user from giving minions, to minions
                    if (client.isMi) {
                        Logger.warn("You cannot give minions to a minion!");
                        return;
                    };

                    // Remove minions
                    if (client.minionControl == true) {
                        client.minionControl = false;
                        client.miQ = 0;
                        this.writeLine("Succesfully removed minions for " + client._name);
                        let text = this.playerTracker._name + " removed all off your minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                        // Add minions
                    } else {
                        client.minionControl = true;
                        // Add minions for client
                        if (isNaN(add)) add = 1;
                        for (let i = 0; i < add; i++) {
                            this.gameServer.bots.addMinion(client);
                        }
                        this.writeLine("Added " + add + " minions for " + client._name);
                        let text = this.playerTracker._name + " gave you " + add + " minions.";
                        this.gameServer.sendChatMessage(null, client, text);
                    }
                }
            }
        }
    },
    addbot: function (args) {
        let add = parseInt(args[1]);
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        for (let i = 0; i < add; i++) {
            this.gameServer.bots.addBot();
        }
        Logger.warn(this.playerTracker.socket.remoteAddress + "ADDED " + add + " BOTS");
        this.writeLine("Added " + add + " Bots");
    },
    status: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        // Get amount of humans/bots
        let humans = 0,
            bots = 0;
        for (let i = 0; i < this.gameServer.clients.length; i++) {
            if ('_socket' in this.gameServer.clients[i]) {
                humans++;
            } else {
                bots++;
            }
        }
        let ini = require('./ini.js');
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        this.writeLine("Connected players: " + this.gameServer.clients.length + "/" + this.gameServer.config.serverMaxConnections);
        this.writeLine("Players: " + humans + " - Bots: " + bots);
        this.writeLine("Server has been running for " + Math.floor(process.uptime() / 60) + " minutes");
        this.writeLine("Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10 + " mb");
        this.writeLine("Current game mode: " + this.gameServer.gameMode.name);
        this.writeLine("Current update time: " + this.gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(this.gameServer.updateTimeAvg) + ")");
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    },
    login: function (args) {
        let password = args[1] + "";
        if (password.length < 1) {
            this.writeLine("ERROR: missing password argument!");
            return;
        }
        let user = this.userLogin(this.playerTracker.socket.remoteAddress, password);
        if (!user) {
            this.writeLine("ERROR: login failed!");
            return;
        }
        Logger.write("LOGIN        " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + user.name + "\"");
        this.playerTracker.userRole = user.role;
        this.playerTracker.userAuth = user.name;
        this.writeLine("Login done as \"" + user.name + "\"");
        return;
    },
    logout: function (args) {
        if (this.playerTracker.userRole == UserRoleEnum.GUEST) {
            this.writeLine("ERROR: not logged in");
            return;
        }
        Logger.write("LOGOUT       " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + this.playerTracker.userAuth + "\"");
        this.playerTracker.userRole = UserRoleEnum.GUEST;
        this.playerTracker.userAuth = null;
        this.writeLine("Logout done");
    },
    shutdown: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        Logger.warn("SHUTDOWN REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(0);
    },
    restart: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        Logger.warn("RESTART REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(3);
    }
};

module.exports = class PlayerCommand {

    /**
     * @param {import("../GameServer")} gameServer 
     * @param {import("../PlayerTracker")} playerTracker 
     */
    constructor(gameServer, playerTracker) {
        this.gameServer = gameServer;
        this.playerTracker = playerTracker;
    }

    writeLine(text) {
        this.gameServer.sendChatMessage(null, this.playerTracker, text);
    }

    executeCommandLine(commandLine) {
        if (!commandLine)
            return;
        // Splits the string
        let args = commandLine.split(" ");
        // Process the first string value
        let first = args[0].toLowerCase();
        // Get command function
        let execute = playerCommands[first];
        if (typeof execute != 'undefined') {
            execute.bind(this)(args);
        }
        else {
            this.writeLine("ERROR: Unknown command, type /help for command list");
        }
    }
    userLogin(ip, password) {
        if (!password)
            return null;
        password = password.trim();
        if (!password)
            return null;
        for (let i = 0; i < this.gameServer.userList.length; i++) {
            let user = this.gameServer.userList[i];
            if (user.password != password)
                continue;
            if (user.ip && user.ip != ip && user.ip != "*") // * - means any IP
                continue;
            return user;
        }
        return null;
    }
}