module.exports = {
    Mode: require('./Mode'),
    FFA: require('./FFA'),
    Teams: require('./Teams'),
    Experimental: require('./Experimental'),
    Rainbow: require('./Rainbow'),
    Tournament: require('./Tournament'),
    HungerGames: require('./HungerGames'),
    get: get = id => {
        let mode;
        console.log(`Getting Game Mode ${id}`)
        switch (parseInt(id)) {
            case 1: // Teams
                mode = new module.exports.Teams();
                break;
            case 2: // Experimental
                mode = new module.exports.Experimental();
                break;
            case 3: // Rainbow
                mode = new module.exports.Rainbow();
                break;
            case 4:// Tournament
                mode = new module.exports.Tournament();
                break;
            case 5:// Hunger Games
                mode = new module.exports.HungerGames();
                break;
            default: // FFA is default
                mode = new module.exports.FFA();
                break;
        }
        return mode;
    }
};