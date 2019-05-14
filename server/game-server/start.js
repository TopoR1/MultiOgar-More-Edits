const gameServer = new (require("./GameServer"))();
require("./argParser")(gameServer, process.argv);
gameServer.start();