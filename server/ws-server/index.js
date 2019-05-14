const Client = require("./Client");

/**
 * @param {WebSocket} ws
 * @param {import("express").Request} req
 */
module.exports = (ws, req) => {
    let origin = req.headers.origin;
    let token = req.cookies.token;
    let validToken = true;
}