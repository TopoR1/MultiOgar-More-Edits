'use strict';
/*
 * Fast and easy Quad-Tree implementation written by Barbosik.
 * Useful for quick object search in the area specified with bounds.
 *
 * Copyright (c) 2016 Barbosik https://github.com/Barbosik
 * License: Apache License, Version 2.0
 */
module.exports = class QuadNode {

    constructor(bound) {
        this.halfWidth = (bound.maxx - bound.minx) / 2;
        this.halfHeight = (bound.maxy - bound.miny) / 2;
        this.bound = bound;
        this.bound.cx = bound.minx + this.halfWidth;
        this.bound.cy = bound.miny + this.halfHeight;
        this.childNodes = [];
        this.items = [];
    }

    insert(item) {
        if (this.childNodes.length != 0) {
            let quad = this.getQuad(item.bound);
            if (quad !== -1)
                return this.childNodes[quad].insert(item);
        }
        this.items.push(item);
        item._quadNode = this; // used for quick search quad node by item
        // split and rebalance current node
        if (this.childNodes.length == 0 && this.items.length > 64) {
            // split into 4 subnodes (top, left, bottom, right)
            let w = this.halfWidth;
            let h = this.halfHeight;
            let my = this.bound.miny;
            let mx = this.bound.minx;
            let mh = my + h;
            let mw = mx + w;
            let b0 = { minx: mw, miny: my, maxx: mw + w, maxy: my + h };
            let b1 = { minx: mx, miny: my, maxx: mx + w, maxy: my + h };
            let b2 = { minx: mx, miny: mh, maxx: mx + w, maxy: mh + h };
            let b3 = { minx: mw, miny: mh, maxx: mw + w, maxy: mh + h };
            this.childNodes.push(new QuadNode(b0));
            this.childNodes.push(new QuadNode(b1));
            this.childNodes.push(new QuadNode(b2));
            this.childNodes.push(new QuadNode(b3));
        }
    }
    remove(item) {
        if (item._quadNode !== this)
            return item._quadNode.remove(item);
        this.items.splice(this.items.indexOf(item), 1);
        item._quadNode = null;
    }
    find(bound, callback) {
        if (this.childNodes.length != 0) {
            let quad = this.getQuad(bound);
            if (quad !== -1) {
                this.childNodes[quad].find(bound, callback);
            }
            else {
                for (let i = 0; i < this.childNodes.length; i++) {
                    let node = this.childNodes[i];
                    if (!this.intersects(node.bound, bound))
                        node.find(bound, callback);
                }
            }
        }
        for (let i = 0; i < this.items.length; i++) {
            let item = this.items[i];
            if (!this.intersects(item.bound, bound))
                callback(item.cell);
        }
    }
    // Returns quadrant for the bound.
    // Returns -1 if bound cannot completely fit within a child node
    getQuad(bound) {
        let isTop = (bound.miny && bound.maxy) < this.bound.cy;
        if ((bound.minx && bound.maxx) < this.bound.cx) {
            if (isTop)
                return 1;
            else if (bound.miny > this.bound.cy)
                return 2; // isBottom
        }
        else if (bound.minx > this.bound.cx) { // isRight
            if (isTop)
                return 0;
            else if (bound.miny > this.bound.cy)
                return 3; // isBottom
        }
        return -1; // cannot fit (too large size)
    }
    intersects(a, b) {
        return b.minx >= a.maxx || b.maxx <= a.minx
            || b.miny >= a.maxy || b.maxy <= a.miny;
    }
}