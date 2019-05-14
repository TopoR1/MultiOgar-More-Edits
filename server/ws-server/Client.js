const logger = require("../../../../../util/logger");
const rand = require("rand-token");
const pm2 = require("pm2");
const validServerIDs = (() => {
    let ids = [];
    let settings = require("../config.json");
    for (let id in settings) for (let i = 0; i < (settings[id].instances || 1); i++) {
        ids.push(id + "-" + (i + 1));
    }
    return ids;
})();

logger.debug(`Running Ogar Instances: ${validServerIDs.join(", ")}`);

pm2.connect(err => {

    pm2.launchBus((err, bus) => {

        for (let serverID of validServerIDs) {

            bus.on(`ogar-server-${serverID}:game`, message => {

                if (connected.length === 0) return;
    
            });
            bus.on(`ogar-server-${serverID}:disconnect`, message => {
                let player = connected.find(player => player.hash === message.data.hash);
                if (player) {
                    player.disconnect(false, message.data.reason || "");
                } else {
                    // console.log("Can't find player with hash " + message.data.hash);
                }
            });
            bus.on(`ogar-server-${serverID}:info`, message => {
                connected.forEach(player => player.sendToClient(ToBuffer(NetEventCode.INFO, message.data)));
            });
            bus.on(`ogar-server-${serverID}:err`, message => {
                let player = connected.find(player => player.hash === message.data.hash);
            });
        }

    });
});

module.exports = class Client {
    /**
     * 
     * @param {WebSocket} socket 
     * @param {{name: String; avatar: String, id: Number}} info
     */
    constructor(socket, info) {
        this.hash = rand.uid(16);
        connected.push(this);
        this.initSocket(socket);
        this.user = info;
        this.serverID = 0;
        logger.log(this.user.name + " connected");
        this.head = [];
        this.dir = [0, -1];   
    }

    /** @param {WebSocket} socket */
    initSocket(socket) {

        socket.on("message", data => {
            if (!(data instanceof ArrayBuffer)) {
                socket.close();
                return;
            }
            let view = new DataView(data);
            
        });

        socket.onerror = (ws, err) => {
            logger.verbose(ws, err);
            this.disconnect(true, "Socket Error");
        }

        socket.onclose = (ws, err) => {
            this.disconnect(true, "Socket Closed");
        }
        this.socket = socket;
        // this.sendToClient(ToBuffer(NetEventCode.SERVER_LIST, `["${validServerIDs.join("\",\"")}"]`));
    }

    joinGame() {

    }

    disconnect(tellServer, reason){
        if (this.disconnected) return;
        else this.disconnected = true;
        connected.splice(connected.indexOf(this), 1);
        try {
            reason = reason || "Unknown Reason";
            this.socket.send(ToBuffer(99, reason));
            this.socket.close();
        } catch (e) {};
        if (tellServer) this.sendToGameServer("disconnect", {hash: this.hash});
        logger.log(`${this.user.name} disconnected${reason ? " reason: " + reason : "."}`);
    }

    sendToGameServer(message, data){
        data = data || {};
        data.user = this.user;
        data.hash = this.hash;
        process.send({
            type: `ogar-${this.serverID}:${message}`,
            data: data
        });
    }

    sendToClient(data){
        if (this.socket && this.socket.readyState === 1) this.socket.send(data);
    }
}