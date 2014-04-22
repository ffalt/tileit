var fs = require('fs');
var path = require('path');
var async = require("async");
var MetaTile = require("./utils/metatile.js").MetaTile;
var MetaTileRequest = require("./utils/metatile_request.js").MetaTileRequest;

var metatileoptions = {
	metaTileCount: 8,
	tileSize: 256,
	tirex: true
};

function MetaFile(name, settings) {
	this.name = name;
	this.settings = settings;
	this.requests = {};

}

MetaFile.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

/**
 * checks if file exist and answer request
 */

MetaFile.prototype.getImage = function (treq, options) {
	var meta_x = treq.x - treq.x % 8;
	var meta_y = treq.y - treq.y % 8;
//	var l = this.fingerprint(options.name, meta_x, meta_y, treq.z);
//	if (this.requests[l]) {
//		//there is a matching pending render request, so attach
//		global.logger.debug('[MetaTile] tile request queued since a request for this meta already running');
//		this.requests[l].push(treq);
//		return;
//	}
	var caller = this;
	var meta_req = new MetaTileRequest(new MetaTile(meta_x, meta_y, treq.z, metatileoptions));
	meta_req.map = options;
	meta_req.push(treq);
//	this.requests[l] = meta_req;
	meta_req.readImage(options.tilesPath, function (err) {
		if (err) {
			treq.finish('file not found');
//		} else {
//			delete caller.requests[l];
		}
	});
};


exports.Plug = MetaFile;