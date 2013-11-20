var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var BaseStorage = require('./plug.js').BaseStorage;
var Stats = require('./stats.js').Stats;
var config = require('../config.js');

function FileStorage() {
	this.stats = new Stats("file");
}

FileStorage.prototype = new BaseStorage();

FileStorage.prototype.isKnownMap = function (mapname) {
	return config.file.maps[mapname];
};

BaseStorage.prototype.wantsStorage = function (mapname) {
	return config.file.maps[mapname].allow_store;
};

FileStorage.prototype.getStats = function () {
	return this.stats.getStats();
};

FileStorage.prototype.hasValidParams = function (mapname, x, y, z, format) {
	var map = config.file.maps[mapname];
	return map && (z >= map.minz) && (z < map.maxz) && (map.allowed_format.indexOf(format) >= 0);
};

FileStorage.prototype.storeImage = function (mapname, x, y, z, format, data, cb) {
	var map = config.file.maps[mapname];
	var tile_file = path.resolve(map.path, [z, x, y + '.' + format].join('/'));
	fs.exists(tile_file, function (e) {
		if (!e) {
			console.debug('[File] Storing', tile_file);
			fs.writeFile(tile_file, data, function (err) {
				if (err) {
					console.error('[File] Could not save file: ', tile_file, err)
				} else {
					console.debug('[File] Ok, Stored', tile_file);
				}
				cb(err);
			});
		} else
			cb();
	})
};

FileStorage.prototype.getImage = function (mapname, x, y, z, format, cb) {
	var map = config.file.maps[mapname];
	var tile_file = path.resolve(map.path, [z, x, y + '.' + format].join('/'));
	var caller = this;
	fs.exists(tile_file, function (e) {
		if (e) {
			caller.stats.served(mapname);
			cb(null, {filename: tile_file});
		} else {
			caller.stats.missing(mapname);
			cb('not found')
		}
	});
};

exports.Storage = FileStorage;