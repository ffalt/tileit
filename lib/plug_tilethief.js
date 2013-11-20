var request = require('request');
var async = require('async');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var BaseStorage = require('./plug.js').BaseStorage;
var Stats = require('./stats.js').Stats;
var config = require('../config.js');

function TileThief() {
	var caller = this;
	this.queue = async.queue(function (task, callback) {
		caller.request(task.mapname, task.tile_url, task.tile_file, function (err, data) {
			if (err)
				task.cb(err)
			else
				task.cb(null, data);
			callback();
		});
	}, config.tilethief.concurrent_requests);
	this.stats = new Stats("tilethief");
}

TileThief.prototype = new BaseStorage();

TileThief.prototype.isKnownMap = function (mapname) {
	return config.tilethief.maps[mapname];
};

TileThief.prototype.getStats = function () {
	return this.stats.getStats();
};

TileThief.prototype.hasValidParams = function (mapname, x, y, z, format) {
	var map = config.tilethief.maps[mapname];
	return map && (z >= map.minz) && (z < map.maxz) && (map.allowed_format.indexOf(format) >= 0);
};

TileThief.prototype.request = function (mapname, tile_url, tile_file, cb) {
	console.debug('[Tilethief] Request from backend: ' + tile_url);
	var caller = this;
	request.head(tile_url, function (err, resp, data) {
		if (err || resp.statusCode !== 200 || !(resp.headers["content-type"].match(/^image\//))) {
			caller.stats.missing(mapname);
			console.error("[Tilethief] Could not fetch tile from backend", tile_url);
			return cb('Could not fetch tile from backend');
		}
		var ws = fs.createWriteStream(tile_file);
		/* make copy of tile for cache */
		var error;
		request(tile_url)
			//TODO error on handler or err parameter in end???
			.on('error', function (err) {
				error = err;
				ws.end();
			})
			.on('end',function () {
				ws.end();
			}).pipe(ws);
		ws.on('close', function (err) {
			error = error || err;
			if (!error) {
				caller.stats.served(mapname);
				caller.stats.processed(mapname);
			} else {
				console.error("[Tilethief] Could not fetch tile from backend", tile_url);
				caller.stats.missing(mapname);
			}
			cb(error, {filename: tile_file});
		});
	});
};

TileThief.prototype.getImage = function (mapname, x, y, z, format, cb) {
	var map = config.tilethief.maps[mapname];
	var tile_file = path.resolve(map.path, [z, x, y + '.' + format].join('/'));
	var caller = this;
	fs.exists(tile_file, function (e) {
		if (e) {
			caller.stats.served(mapname);
			cb(null, null, tile_file);
		} else {
			/* mkdirp for local file */
			mkdirp(path.dirname(tile_file), function (err) {
				if (err) {
					console.error("[Tilethief] Could not create directory", path.dirname(tile_file), err);
					return cb(err);
				}
				/* retrieve file from backend */
				var tile_url = [map.backend_url, map.backend_map, z, x, y + '.' + format].join('/');
				caller.queue.push({mapname: mapname, tile_url: tile_url, tile_file: tile_file, cb: cb}, function (err) {
					if (err) {
						console.error("[Tilethief] Error fetching tile:", path.dirname(tile_file), err);
					}
				});
			});
		}
	});
};


exports.Storage = TileThief;
