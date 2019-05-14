// Imports
const Logger = require('../modules/Logger');
const Commands = require('../modules/CommandList');

/**
 * @param {import("./GameServer")} gameServer
 * @param {String[]} args
 */
module.exports = (gameServer, args) => {
    // Init variables
    let showConsole = true;
    Logger.info("Version: " + gameServer.version);
    args.forEach(item => {

        switch (item){
            case "--help":
                console.log("Proper Usage: node index.js");
                console.log("    -n, --name             Set name");
                console.log("    -g, --gameport         Set game port");
                console.log("    -s, --statsport        Set stats port");
                console.log("    -m, --gamemode         Set game mode (id)");
                console.log("    -c, --connections      Set max connections limit");
                console.log("    -t, --tracker          Set serverTracker");
                console.log("    -l, --light-background Set a light-background colorscheme for logger")
                console.log("    --noconsole            Disables the console");
                console.log("    --help                 Help menu");
                console.log("");
                break;
    
            case "-n":
            case "--name":
                setParam("serverName", getValue(item));
                break;
    
            case "-g":
            case "--gameport":
                setParam("serverPort", parseInt(getValue(item)));
                break;
            case "-s":
            case "--statsport":
                setParam("serverStatsPort", parseInt(getValue(item)));
                break;
    
            case "-m":
            case "--gamemode":
                setParam("serverGamemode", getValue(item));
                break;
    
            case "-c":
            case "--connections":
                setParam("serverMaxConnections", parseInt(getValue(item)));
                break;
            case "-t":
            case "--tracker":
                setParam("serverTracker", parseInt(getValue(item)));
                break;
    
            case "-l":
            case "--light-background":
                //Has already been processed before logger initialisation
                break;
    
            case "--noconsole":
                showConsole = false;
                break;
        }
    });

    // Initialize the server console
    if (showConsole) {
        let readline = require('readline');
        var cmdUI = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const prompt = () => {
            cmdUI.question(">", str => {
                try {
                    parseCommands(str);
                } catch (err) {
                    Logger.error(err.stack);
                } finally {
                    setTimeout(prompt, 10);
                }
            });
        }
        setTimeout(prompt, 100);
    }

    const getValue = param => {
        let ind = process.argv.indexOf(param);
        let item  = process.argv[ind + 1]
        if (!item || item.indexOf('-') != -1){
            Logger.error("No value for " + param);
            return null;
        } else{
            return item;
        }
    }
    
    const setParam = (paramName, val) => {
        if (!gameServer.config.hasOwnProperty(paramName)){
            Logger.error("Wrong parameter");
        }
        if (val || val === 0) {
            gameServer.config[paramName] = val;
        }
    }
    
    /**
     * @param {String} str 
     */
    const parseCommands = str => {
        
        // Don't process ENTER
        if (str === '')
            return;
    
        // Log the string
        Logger.write(">" + str);
    
        // Splits the string
        let split = str.split(" ");
    
        // Process the first string value
        let first = split[0].toLowerCase();
    
        // Get command function
        let execute = Commands[first];
        if (typeof execute != 'undefined') {
            execute(gameServer, split);
        } else {
            Logger.warn("Invalid Command!");
        }
    };
}