const Mode = require('./Mode');

module.exports = class Tournament extends Mode{

    constructor() {
        super();
        this.ID = 4;
        this.name = "Tournament";
        this.packetLB = 48;
        this.IsTournament = true;
        // Config (1 tick = 1000 ms)
        this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
        this.endTime = 15; // Amount of ticks after someone wins to restart the game
        this.autoFill = false;
        this.autoFillPlayers = 1;
        this.dcTime = 0;
        // Gamemode Specific Variables
        this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
        this.contenders = [];
        this.maxContenders = 12;
        this.isPlayerLb = false;
        this.winner;
        this.timer;
        this.timeLimit = 3600; // in seconds
    }
    // Gamemode Specific Functions
    startGamePrep(gameServer) {
        this.gamePhase = 1;
        this.timer = this.prepTime; // 10 seconds
    }
    startGame(gameServer) {
        gameServer.run = true;
        this.gamePhase = 2;
        this.getSpectate(); // Gets a random person to spectate
        gameServer.config.playerDisconnectTime = this.dcTime; // Reset config
    }
    endGame(gameServer) {
        this.winner = this.contenders[0];
        this.gamePhase = 3;
        this.timer = this.endTime; // 30 Seconds
    }
    endGameTimeout(gameServer) {
        gameServer.run = false;
        this.gamePhase = 4;
        this.timer = this.endTime; // 30 Seconds
    }
    fillBots(gameServer) {
        // Fills the server with bots if there arent enough players
        let fill = this.maxContenders - this.contenders.length;
        for (let i = 0; i < fill; i++) {
            gameServer.bots.addBot();
        }
    }
    getSpectate() {
        // Finds a random person to spectate
        let index = Math.floor(Math.random() * this.contenders.length);
        this.rankOne = this.contenders[index];
    }
    prepare(gameServer) {
        // Remove all cells
        let len = gameServer.nodes.length;
        for (let i = 0; i < len; i++) {
            let node = gameServer.nodes[0];
            if (!node) {
                continue;
            }
            gameServer.removeNode(node);
        }
        //Kick all bots for restart.
        for (let i = 0; i < gameServer.clients.length; i++) {
            if (gameServer.clients[i].isConnected != null)
                continue; // verify that the client is a bot
            gameServer.clients[i].close();
        }
        gameServer.bots.loadNames();
        // Pauses the server
        gameServer.run = false;
        this.gamePhase = 0;
        // Get config values
        if (gameServer.config.tourneyAutoFill > 0) {
            this.timer = gameServer.config.tourneyAutoFill;
            this.autoFill = true;
            this.autoFillPlayers = gameServer.config.tourneyAutoFillPlayers;
        }
        // Handles disconnections
        this.dcTime = gameServer.config.playerDisconnectTime;
        gameServer.config.playerDisconnectTime = 0;
        this.prepTime = gameServer.config.tourneyPrepTime;
        this.endTime = gameServer.config.tourneyEndTime;
        this.maxContenders = gameServer.config.tourneyMaxPlayers;
        // Time limit
        this.timeLimit = gameServer.config.tourneyTimeLimit * 60; // in seconds
    }
    onPlayerDeath(gameServer) {
        // Nothing
    }
    formatTime(time) {
        if (time < 0) {
            return "0:00";
        }
        // Format
        let min = Math.floor(this.timeLimit / 60);
        let sec = this.timeLimit % 60;
        sec = (sec > 9) ? sec : "0" + sec.toString();
        return min + ":" + sec;
    }
    // Override
    onServerInit(gameServer) {
        this.prepare(gameServer);
    }
    onPlayerSpawn(gameServer, player) {
        // Only spawn players if the game hasnt started yet
        if ((this.gamePhase == 0) && (this.contenders.length < this.maxContenders)) {
            player.color = gameServer.getRandomColor(); // Random color
            this.contenders.push(player); // Add to contenders list
            gameServer.spawnPlayer(player, gameServer.randomPos());
            if (this.contenders.length == this.maxContenders) {
                // Start the game once there is enough players
                this.startGamePrep(gameServer);
            }
        }
    }
    onCellRemove(cell) {
        let owner = cell.owner, human_just_died = false;
        if (owner.cells.length <= 0) {
            // Remove from contenders list
            let index = this.contenders.indexOf(owner);
            if (index != -1) {
                if ('_socket' in this.contenders[index].socket) {
                    human_just_died = true;
                }
                this.contenders.splice(index, 1);
            }
            // Victory conditions
            let humans = 0;
            for (let i = 0; i < this.contenders.length; i++) {
                if ('_socket' in this.contenders[i].socket) {
                    humans++;
                }
            }
            // the game is over if:
            // 1) there is only 1 player left, OR
            // 2) all the humans are dead, OR
            // 3) the last-but-one human just died
            if ((this.contenders.length == 1 || humans == 0 || (humans == 1 && human_just_died)) && this.gamePhase == 2) {
                this.endGame(cell.owner.gameServer);
            }
            else {
                // Do stuff
                this.onPlayerDeath(cell.owner.gameServer);
            }
        }
    }
    updateLB_FFA(gameServer, lb) {
        gameServer.leaderboardType = 49;
        for (let i = 0, pos = 0; i < gameServer.clients.length; i++) {
            let player = gameServer.clients[i].playerTracker;
            if (player.isRemoved || !player.cells.length ||
                player.socket.isConnected == false || player.isMi)
                continue;
            for (let j = 0; j < pos; j++)
                if (lb[j]._score < player._score)
                    break;
            lb.splice(j, 0, player);
            pos++;
        }
        this.rankOne = lb[0];
    }
    updateLB(gameServer, lb) {
        gameServer.leaderboardType = this.packetLB;
        switch (this.gamePhase) {
            case 0:
                lb[0] = "Waiting for";
                lb[1] = "players: ";
                lb[2] = this.contenders.length + "/" + this.maxContenders;
                if (this.autoFill) {
                    if (this.timer <= 0) {
                        this.fillBots(gameServer);
                    }
                    else if (this.contenders.length >= this.autoFillPlayers) {
                        lb[3] = "-----------------";
                        lb[4] = "Bots joining";
                        lb[5] = "in";
                        lb[6] = this.timer.toString();
                        this.timer--;
                    }
                }
                break;
            case 1:
                lb[0] = "Game starting in";
                lb[1] = this.timer.toString();
                lb[2] = "Good luck!";
                if (this.timer <= 0) {
                    // Reset the game
                    this.startGame(gameServer);
                }
                else {
                    this.timer--;
                }
                break;
            case 2:
                if (!this.isPlayerLb) {
                    gameServer.leaderboardType = this.packetLB;
                    lb[0] = "Players Remaining";
                    lb[1] = this.contenders.length + "/" + this.maxContenders;
                    lb[2] = "Time Limit:";
                    lb[3] = this.formatTime(this.timeLimit);
                }
                else {
                    this.updateLB_FFA(gameServer, lb);
                }
                if (this.timeLimit < 0) {
                    // Timed out
                    this.endGame(gameServer);
                }
                else {
                    if (this.timeLimit % gameServer.config.tourneyLeaderboardToggleTime == 0) {
                        this.isPlayerLb ^= true;
                    }
                    this.timeLimit--;
                }
                break;
            case 3:
                lb[0] = "Congratulations";
                lb[1] = this.winner._name;
                lb[2] = "for winning!";
                if (this.timer <= 0) {
                    // Reset the game
                    this.prepare(gameServer);
                    this.endGameTimeout(gameServer);
                }
                else {
                    lb[3] = "-----------------";
                    lb[4] = "Game restarting in";
                    lb[5] = this.timer.toString();
                    this.timer--;
                }
                break;
            case 4:
                lb[0] = "Time Limit";
                lb[1] = "Reached!";
                if (this.timer <= 0) {
                    // Reset the game
                    this.onServerInit(gameServer);
                }
                else {
                    lb[2] = "Game restarting in";
                    lb[3] = this.timer.toString();
                    this.timer--;
                }
            default:
                break;
        }
    }
}