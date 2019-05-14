// An object representing a 2D vector.
// Based on the Vector2 class from LibGDX.
// Written by Rahat Ahmed (http://rahatah.me/d).
module.exports = class Vec2 {

    /**
     * @param {Number} x 
     * @param {Number} y 
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(d, m) {
        this.x += d.x * m;
        this.y += d.y * m;
        return this;
    }

    sub(x, y) {
        if (x instanceof Vec2) {
            this.x -= x.x;
            this.y -= x.y;
        }
        else {
            this.x -= x;
            this.y -= y;
        }
        return this;
    }

    sub2(d, m) {
        this.x -= d.x * m;
        this.y -= d.y * m;
        return this;
    }

    angle() {
        return Math.atan2(this.x, this.y);
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    dist() {
        return ~~this.x * ~~this.x + ~~this.y * ~~this.y;
    }

    sqDist() {
        return Math.sqrt(this.dist());
    }

    normalize() {
        return this.scale(1 / this.sqDist());
    }

    /**
     * @param {Number} scaleX 
     * @param {Number} scaleY 
     */
    scale(scaleX, scaleY) {
        this.x *= scaleX;
        this.y *= scaleY || scaleX;
        return this;
    }
}