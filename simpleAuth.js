const config = require("./config.json");

function isStreamer(token) {
    return config.simpleAuth.streamers.includes(token)
}

function isCoordinator(token) {
    return config.simpleAuth.coordinators.includes(token)
}

function isAdmin(token){
    return config.simpleAuth.admins.includes(token)
}

module.exports = {
    isCoordinator,
    isStreamer,
    isAdmin
}