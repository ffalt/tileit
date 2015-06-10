var fs = require('fs');
var path = require('path');
var MetaTile = require("./utils/metatile.js").MetaTile;
var MetaTileRequest = require("./utils/metatile_request.js").MetaTileRequest;

function MetaFile(name, settings) {
	this.name = name;
	this.settings = settings;
	this.requests = {};
}

MetaFile.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

/**
 * checks if file exist and answers request
 */

MetaFile.prototype.getImage = function (treq, options) {
	var meta_x = treq.x - treq.x % 8;
	var meta_y = treq.y - treq.y % 8;
	var meta_req = new MetaTileRequest(new MetaTile(meta_x, meta_y, treq.z, options));
	meta_req.map = options;
	meta_req.push(treq);
	meta_req.readImage(options.tilesPath, function (err) {
		if (err) treq.finish('file not found');
		//readImage sends the file if found
	});
};


exports.Plug = MetaFile;