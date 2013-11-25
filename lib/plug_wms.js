var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var proj4 = require('proj4');
var request = require('request');
var BaseStorage = require('./plug.js').BaseStorage;
var Stats = require('./stats.js').Stats;
var config = require('../config.js');

function WMS() {
	this.stats = new Stats("wms");
	this.maps = {};
	this.init();
}

WMS.prototype = new BaseStorage();

WMS.prototype.isKnownMap = function (mapname) {
	return config.wms.maps[mapname];
};

WMS.prototype.getStats = function () {
	return this.stats.getStats();
};

WMS.prototype.hasValidParams = function (mapname, x, y, z, format) {
	var map = config.wms.maps[mapname];
	return map && (z >= map.minz) && (z < map.maxz) && (map.format == format);
};

WMS.prototype.storeImage = function (mapname, x, y, z, format, data, cb) {
	var map = config.wms.maps[mapname];
	var tile_file = path.resolve(map.path, [z, x, y + '.' + format].join('/'));
	fs.exists(tile_file, function (e) {
		if (!e) {
			console.debug('[WMS] Storing', tile_file);
			fs.writeFile(tile_file, data, function (err) {
				if (err) {
					console.error('[WMS] Could not save file: ', tile_file, err)
				} else {
					console.debug('[WMS] Ok, Stored', tile_file);
				}
				cb(err);
			});
		} else
			cb();
	})
};

WMS.prototype.init = function () {
	for (var key in config.wms.maps) {
		var map = config.wms.maps[key];
		var params = [];
		params.push("LAYERS=" + (map.layers || ''));
		params.push("SERVICE=" + (map.service || 'WMS'));
		params.push("VERSION=" + (map.version || "1.1.1"));
		params.push("REQUEST=GetMap");
		params.push("TRANSPARENT=" + (map.transparent || "false"));
		params.push("STYLES=" + (map.styles || ''));
		params.push("FORMAT=" + 'image/' + (map.format || 'jpeg'));
		params.push("WIDTH=" + (map.tilesize || 256));
		params.push("HEIGHT=" + (map.tilesize || 256));
		var _crs = EPSG[map.crs];
		if (!_crs)
			console.error('[WMS] Invalid CRS:', map.crs, 'map:', key);
		var v = parseFloat(map.version);
		var projectionKey = v >= 1.3 ? 'CRS' : 'SRS';
		params.push(projectionKey + "=" + map.crs);
		var _map = {
			name: key,
			crs: _crs,
			v: v,
			tilesize: map.tilesize,
			url: map.url + ((map.url.indexOf('?') < 0) ? "?" : "&") + params.join('&')
		};
		this.maps[key] = _map;
	}
};

var EPSG4326 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';
var EPSG3857 = '+proj=longlat +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs';
var EPSG = {
	"EPSG:4326": EPSG4326,
	"EPSG:3857": EPSG3857
};

var EPSG3857Transform = {
	_a: 0.5 / Math.PI,
	_b: 0.5,
	_c: -0.5 / Math.PI,
	_d: 0.5,
	RAD_TO_DEG: 180 / Math.PI
};

function pointToLatLng_EPSG3857(p, zoom) {
	var scale = 256 * Math.pow(2, zoom);
	p[0] = (p[0] / scale - EPSG3857Transform._b) / EPSG3857Transform._a;
	p[1] = (p[1] / scale - EPSG3857Transform._d) / EPSG3857Transform._c;
	var lng = p[0] * EPSG3857Transform.RAD_TO_DEG;
	var lat = (2 * Math.atan(Math.exp(p[1])) - (Math.PI / 2)) * EPSG3857Transform.RAD_TO_DEG;
	return {lat: lat, lng: lng};
};

WMS.prototype.bbox = function (x, y, z, tilesize, crs) {
	var nwPoint = [x * tilesize, y * tilesize];
	var sePoint = [nwPoint[0] + tilesize, nwPoint[1] + tilesize];
	var nwLatLng = pointToLatLng_EPSG3857(nwPoint, z);
	var seLatLng = pointToLatLng_EPSG3857(sePoint, z);
	var nw = proj4(crs, crs, [nwLatLng.lat, nwLatLng.lng]);
	var se = proj4(crs, crs, [seLatLng.lat, seLatLng.lng]);
	return [nw[1], se[0], se[1], nw[0] ].join(',');
};

WMS.prototype.request = function (mapname, x, y, z, format, tile_file, cb) {
	var map = this.maps[mapname];
	var bbox = this.bbox(x, y, z, map.tilesize, map.crs);
	var caller = this;
	var tile_url = map.url + "&BBOX=" + bbox;
	var ws = fs.createWriteStream(tile_file);
	var error = null;
	ws.on('close', function (err) {
		error = error || err;
		if (!error) {
			caller.stats.served(mapname);
			caller.stats.processed(mapname);
		} else {
			fs.unlink(tile_file, function (err) {

			});
			console.error("[WMS] Could not fetch tile from server", error, tile_url);
			caller.stats.missing(mapname);
		}
		cb(error, {filename: tile_file});
	});
	console.log(tile_url);
	request(tile_url)
		.on('error', function (err) {
			error = err;
			ws.end();
		})
		.on('end',function () {
			ws.end();
		}).pipe(ws);
};

WMS.prototype.getImage = function (mapname, x, y, z, format, cb) {
	var map = config.wms.maps[mapname];
	var tile_file = path.resolve(map.path, [z, x, y + '.' + format].join('/'));
	var caller = this;
	fs.exists(tile_file, function (e) {
		if (e) {
			caller.stats.served(mapname);
			cb(null, {filename: tile_file});
		} else {
			mkdirp(path.dirname(tile_file), function (err) {
				if (err) {
					console.error("[WMS] Could not create directory", path.dirname(tile_file), err);
					return cb(err);
				}
				// TODO: queue request
				caller.request(mapname, x, y, z, format, tile_file, cb);
			});
		}
	});
};

exports.Storage = WMS;