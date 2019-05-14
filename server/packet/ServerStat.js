function ServerStat(playerTracker) {
    this.playerTracker = playerTracker;
}

module.exports = ServerStat;

ServerStat.prototype.build = function (protocol) {
    let gameServer = this.playerTracker.gameServer;
    // Get server statistics
    let totalPlayers = 0;
    let alivePlayers = 0;
    let spectPlayers = 0;
    for (let i = 0; i < gameServer.clients.length; i++) {
        let socket = gameServer.clients[i];
        if (socket == null || !socket.isConnected)
            continue;
        totalPlayers++;
        if (socket.playerTracker.cells.length > 0)
            alivePlayers++;
        else
            spectPlayers++;
    }
    let obj = {
        'name': gameServer.config.serverName,
        'mode': gameServer.gameMode.name,
        'uptime': Math.round((gameServer.stepDateTime - gameServer.startTime) / 1000),
        'update': gameServer.updateTimeAvg.toFixed(3),
        'playersTotal': totalPlayers,
        'playersAlive': alivePlayers,
        'playersSpect': spectPlayers,
        'playersLimit': gameServer.config.serverMaxConnections
    };
    let json = JSON.stringify(obj);
    // Serialize
    let BinaryWriter = require("./BinaryWriter");
    let writer = new BinaryWriter();
    writer.writeUInt8(254);             // Message Id
    writer.writeStringZeroUtf8(json);   // JSON
    return writer.toBuffer();
};
