module.exports = class Mode {

    constructor() {
        this.ID = -1;
        this.name = "Blank";
        this.decayMod = 1.0; // Modifier for decay rate (Multiplier)
        this.packetLB = 49; // Packet id for leaderboard packet (48 = Text List, 49 = List, 50 = Pie chart)
        this.haveTeams = false; // True = gamemode uses teams, false = gamemode doesnt use teams
        this.specByLeaderboard = false; // false = spectate from player list instead of leaderboard
        this.IsTournament = false;
    }
    
    // Override these
    onServerInit(gameServer) {
        // Called when the server starts
        gameServer.run = true;
    }
    onTick(gameServer) {
        // Called on every game tick
    }
    onPlayerInit(player) {
        // Called after a player object is constructed
    }
    onPlayerSpawn(gameServer, player) {
        // Called when a player is spawned
        player.color = gameServer.getRandomColor(); // Random color
        gameServer.spawnPlayer(player, gameServer.randomPos());
    }
    onCellAdd(cell) {
        // Called when a player cell is added
    }
    onCellRemove(cell) {
        // Called when a player cell is removed
    }
    onCellMove(cell, gameServer) {
        // Called when a player cell is moved
    }
    updateLB(gameServer) {
        // Called when the leaderboard update function is called
        gameServer.leaderboardType = this.packetLB;
    }
}