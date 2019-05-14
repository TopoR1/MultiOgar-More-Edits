const { ClearAll, ServerStat, SetBorder } = require('../packet');
const BinaryReader = require('../packet/BinaryReader');
const WebSocket = require("ws");

module.exports = class PacketHandler {

    /**
     * @param {import("./GameServer")} gameServer 
     * @param {import("ws")} socket 
     */
    constructor(gameServer, socket) {
        this.gameServer = gameServer;
        this.socket = socket;
        this.protocol = 0;
        this.handshakeProtocol = null;
        this.handshakeKey = null;
        this.lastJoinTick = 0;
        this.lastChatTick = 0;
        this.lastStatTick = 0;
        this.lastQTick = 0;
        this.lastSpaceTick = 0;
        this.pressQ = false;
        this.pressW = false;
        this.pressSpace = false;
        this.mouseData = null;
        this.handler = {
            254: this.handshake_onProtocol.bind(this),
        };
    }

    handleMessage(message) {
        if (!this.handler.hasOwnProperty(message[0]))
            return;
        this.handler[message[0]](message);
        this.socket.lastAliveTime = this.gameServer.stepDateTime;
    }

    handshake_onProtocol(message) {
        if (message.length !== 5)
            return;
        this.handshakeProtocol = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
        if (this.handshakeProtocol < 1 || this.handshakeProtocol > 18) {
            this.socket.close(1002, "Not supported protocol: " + this.handshakeProtocol);
            return;
        }
        this.handler = {
            255: this.handshake_onKey.bind(this),
        };
    }

    handshake_onKey(message) {
        if (message.length !== 5)
            return;
        this.handshakeKey = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
        if (this.handshakeProtocol > 6 && this.handshakeKey !== 0) {
            this.socket.close(1002, "Not supported protocol");
            return;
        }
        this.handshake_onCompleted(this.handshakeProtocol, this.handshakeKey);
    }
    
    handshake_onCompleted(protocol, key) {
        this.handler = {
            0: this.message_onJoin.bind(this),
            1: this.message_onSpectate.bind(this),
            16: this.message_onMouse.bind(this),
            17: this.message_onKeySpace.bind(this),
            18: this.message_onKeyQ.bind(this),
            21: this.message_onKeyW.bind(this),
            22: this.message_onKeyE.bind(this),
            23: this.message_onKeyR.bind(this),
            24: this.message_onKeyT.bind(this),
            25: this.message_onKeyP.bind(this),
            99: this.message_onChat.bind(this),
            254: this.message_onStat.bind(this),
        };
        this.protocol = protocol;
        // Send handshake response
        this.sendPacket(new ClearAll());
        this.sendPacket(new SetBorder(this.socket.playerTracker, this.gameServer.border, this.gameServer.config.serverGamemode, "MultiOgar-Edited " + this.gameServer.version));
        // Send welcome message
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "MultiOgar-Edited " + this.gameServer.version);
        if (this.gameServer.config.serverWelcome1)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome1);
        if (this.gameServer.config.serverWelcome2)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome2);
        if (this.gameServer.config.serverChat == 0)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, "This server's chat is disabled.");
        if (this.protocol < 4)
            this.gameServer.sendChatMessage(null, this.socket.playerTracker, "WARNING: Protocol " + this.protocol + " assumed as 4!");
    }
    message_onJoin(message) {
        let tick = this.gameServer.tickCounter;
        let dt = tick - this.lastJoinTick;
        this.lastJoinTick = tick;
        if (dt < 25 || this.socket.playerTracker.cells.length !== 0) {
            return;
        }
        let reader = new BinaryReader(message);
        reader.skipBytes(1);
        let text = null;
        if (this.protocol < 6)
            text = reader.readStringZeroUnicode();
        else
            text = reader.readStringZeroUtf8();
        this.setNickname(text);
    }
    message_onSpectate(message) {
        if (message.length !== 1 || this.socket.playerTracker.cells.length !== 0) {
            return;
        }
        this.socket.playerTracker.spectate = true;
    }
    message_onMouse(message) {
        if (message.length !== 13 && message.length !== 9 && message.length !== 21) {
            return;
        }
        this.mouseData = Buffer.concat([message]);
    }
    message_onKeySpace(message) {
        if (this.socket.playerTracker.miQ) {
            this.socket.playerTracker.minionSplit = true;
        }
        else {
            this.pressSpace = true;
        }
    }
    message_onKeyQ(message) {
        if (message.length !== 1)
            return;
        let tick = this.gameServer.tickCoutner;
        let dt = tick - this.lastQTick;
        if (dt < this.gameServer.config.ejectCooldown) {
            return;
        }
        this.lastQTick = tick;
        if (this.socket.playerTracker.minionControl && !this.gameServer.config.disableQ) {
            this.socket.playerTracker.miQ = !this.socket.playerTracker.miQ;
        }
        else {
            this.pressQ = true;
        }
    }
    message_onKeyW(message) {
        if (message.length !== 1)
            return;
        if (this.socket.playerTracker.miQ) {
            this.socket.playerTracker.minionEject = true;
        }
        else {
            this.pressW = true;
        }
    }
    message_onKeyE(message) {
        if (this.gameServer.config.disableERTP)
            return;
        this.socket.playerTracker.minionSplit = true;
    }
    message_onKeyR(message) {
        if (this.gameServer.config.disableERTP)
            return;
        this.socket.playerTracker.minionEject = true;
    }
    message_onKeyT(message) {
        if (this.gameServer.config.disableERTP)
            return;
        this.socket.playerTracker.minionFrozen = !this.socket.playerTracker.minionFrozen;
    }
    message_onKeyP(message) {
        if (this.gameServer.config.disableERTP)
            return;
        if (this.gameServer.config.collectPellets) {
            this.socket.playerTracker.collectPellets = !this.socket.playerTracker.collectPellets;
        }
    }
    message_onChat(message) {
        if (message.length < 3)
            return;
        let tick = this.gameServer.tickCounter;
        let dt = tick - this.lastChatTick;
        this.lastChatTick = tick;
        if (dt < 25 * 2) {
            return;
        }
        let flags = message[1]; // flags
        let rvLength = (flags & 2 ? 4 : 0) + (flags & 4 ? 8 : 0) + (flags & 8 ? 16 : 0);
        if (message.length < 3 + rvLength) // second validation
            return;
        let reader = new BinaryReader(message);
        reader.skipBytes(2 + rvLength); // reserved
        let text = null;
        if (this.protocol < 6)
            text = reader.readStringZeroUnicode();
        else
            text = reader.readStringZeroUtf8();
        this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
    }
    message_onStat(message) {
        if (message.length !== 1)
            return;
        let tick = this.gameServer.tickCounter;
        let dt = tick - this.lastStatTick;
        this.lastStatTick = tick;
        if (dt < 25) {
            return;
        }
        this.sendPacket(new ServerStat(this.socket.playerTracker));
    }
    processMouse() {
        if (this.mouseData == null)
            return;
        let client = this.socket.playerTracker;
        let reader = new BinaryReader(this.mouseData);
        reader.skipBytes(1);
        if (this.mouseData.length === 13) {
            // protocol late 5, 6, 7
            client.mouse.x = reader.readInt32() - client.scrambleX;
            client.mouse.y = reader.readInt32() - client.scrambleY;
        }
        else if (this.mouseData.length === 9) {
            // early protocol 5
            client.mouse.x = reader.readInt16() - client.scrambleX;
            client.mouse.y = reader.readInt16() - client.scrambleY;
        }
        else if (this.mouseData.length === 21) {
            // protocol 4
            client.mouse.x = ~~reader.readDouble() - client.scrambleX;
            client.mouse.y = ~~reader.readDouble() - client.scrambleY;
        }
        this.mouseData = null;
    }
    process() {
        if (this.pressSpace) { // Split cell
            this.socket.playerTracker.pressSpace();
            this.pressSpace = false;
        }
        if (this.pressW) { // Eject mass
            this.socket.playerTracker.pressW();
            this.pressW = false;
        }
        if (this.pressQ) { // Q Press
            this.socket.playerTracker.pressQ();
            this.pressQ = false;
        }
        if (this.socket.playerTracker.minionSplit) {
            this.socket.playerTracker.minionSplit = false;
        }
        if (this.socket.playerTracker.minionEject) {
            this.socket.playerTracker.minionEject = false;
        }
        this.processMouse();
    }
    getRandomSkin() {
        let randomSkins = [];
        let fs = require("fs");
        if (fs.existsSync("../src/randomskins.txt")) {
            // Read and parse the Skins - filter out whitespace-only Skins
            randomSkins = fs.readFileSync("../src/randomskins.txt", "utf8").split(/[\r\n]+/).filter(function (x) {
                return x != ''; // filter empty Skins
            });
        }
        // Picks a random skin
        if (randomSkins.length > 0) {
            let index = (randomSkins.length * Math.random()) >>> 0;
            let rSkin = randomSkins[index];
        }
        return rSkin;
    }
    setNickname(text) {
        let name = "", skin = null;
        if (text != null && text.length > 0) {
            let skinName = null, userName = text, n = -1;
            if (text[0] == '<' && (n = text.indexOf('>', 1)) >= 1) {
                let inner = text.slice(1, n);
                if (n > 1)
                    skinName = (inner == "r") ? this.getRandomSkin() : inner;
                else
                    skinName = "";
                userName = text.slice(n + 1);
            }
            skin = skinName;
            name = userName;
        }
        if (name.length > this.gameServer.config.playerMaxNickLength)
            name = name.substring(0, this.gameServer.config.playerMaxNickLength);
        if (this.gameServer.checkBadWord(name)) {
            skin = null;
            name = "Hi there!";
        }
        this.socket.playerTracker.joinGame(name, skin);
    }
    
    sendPacket(packet) {
        let socket = this.socket;
        if (!packet || socket.isConnected == null || socket.playerTracker.isMi)
            return;
        if (socket.readyState == WebSocket.OPEN) {
            let buffer = packet.build(this.protocol);
            if (buffer)
                socket.send(buffer, { binary: true });
        }
        else {
            socket.readyState = WebSocket.CLOSED;
            socket.emit('close');
        }
    }
}