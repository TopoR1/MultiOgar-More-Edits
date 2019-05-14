let BinaryWriter = require('./BinaryWriter');

function LeaderboardPosition(position) {
    this.place = position
}

module.exports = LeaderboardPosition;

LeaderboardPosition.prototype.build = function() {
    let buf = new BinaryWriter();
    buf.writeUInt8(0x30);
    buf.writeUInt16(this.place);
    return buf.toBuffer();
};
