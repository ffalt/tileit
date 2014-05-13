var path = require("path");
var fs = require("fs");
var mapdef = require("./utils/mapdef.js").mapdef;

/**
 * A map
 * @constructor
 */

function Map(name) {
	this.name = name;
	this.mapplugs = [];
}

Map.prototype.storeResult = function (storemapplugs, buffer, treq) {
	var caller = this;
	//storing is async on all backend
	storemapplugs.forEach(function (mapplug) {
		mapplug.plug.storeImage(treq, buffer, mapplug.options, function (err) {
			if (!err)
				global.logger.debug('[Tileit] Tile stored, map:', caller.name, ', plug:', mapplug.plug.name);
		});
	});
};

Map.prototype.getImage = function (treq) {
	var caller = this;
	var storemapplugs = [];
	var error = null;
	var finish = treq.finish;
	var check = function (i) {
		if (i >= caller.mapplugs.length) {
			finish(error || 'internal error, no plugin worked :..(');
			return;
		}
		var mapplug = caller.mapplugs[i];
		if (typeof mapplug.plug.getImage !== 'function') {
			check(i + 1);
			return;
		}
		treq.plugname = mapplug.plug.name;
		treq.finish = function (err, buffer) {
			if ((err) || (!buffer)) {
				if ((!mapplug.options.disableStorage) && (typeof mapplug.plug.storeImage == 'function')) {
					//collecting for maybe storing if any later plug got the image
					storemapplugs.push(mapplug);
				}
				error = err;
				check(i + 1);
			} else {
				global.logger.debug('[Tileit] Success, now sending data:', mapplug.plug.name, 'map:', caller.name);
				finish(err, buffer);
				caller.storeResult(storemapplugs, buffer, treq);
			}
		};
		//global.logger.debug('[Tileit] Checking Plug:', mapplug.plug.name, 'map:', caller.name);
		mapplug.plug.getImage(treq, mapplug.options);
	};
	check(0);
};

Map.prototype.toLine = function () {
	return this.name + ' [' + this.minz + '-' + this.maxz + '] ' +
		this.mapplugs.map(function (mapplug) {
			return mapplug.plug.name;
		}).join(',');
};

Map.prototype.load = function (options, plugs) {
	this.minz = options.minz || 0;
	this.maxz = options.maxz || 18;
	this.format = options.format || 'png';
	if (!options.bounds || options.bounds.length !== 4)
		this.bounds = [ -180, -85.05112877980659, 180, 85.05112877980659 ];

	this.options = options;
	for (var i = 0; i < options.sources.length; i++) {
		var plug_options = options.sources[i];
		var plug = plugs[plug_options.plug];
		if (!plug) {
			global.logger.error('[Tileit] Unknown plug ' + plug_options.name + ' for map ' + this.name);
			return false;
		}
		plug_options.format = plug_options.format || this.format;
		if (typeof plug.validateMapOptions == 'function')
			plug.validateMapOptions(this.name, plug_options);
		this.mapplugs.push({plug: plug, options: plug_options});
	}
	if (this.mapplugs.length == 0) {
		global.logger.error('[Tileit] No plugs for map', this.name);
		return false;
	}
	return true;
};

Map.prototype.hasValidParams = function (x, y, z, format) {
	var limit = Math.pow(2, z) - 1;
//	var mx = x - x % 8;
//	var my = y - y % 8;
//	var limit = 1 << z;
	if ((x < 0) || (y < 0) || (x > limit) || (y > limit)) {
		return false;
	}
	return (z >= this.minz) && (z <= this.maxz) && (this.format == format);
};

/**
 * Holds all the maps together
 * @constructor
 */

function Machine() {
	this.maps = {};
}

/**
 * load the maps and init them
 */

Machine.prototype.init = function (plugs, config, cb) {
	var caller = this;
	this.config = config;

	//special handling for tirex maps
	var tirexpath = plugs['tirex'] ? path.resolve(plugs['tirex'].settings.config_dir) : null;

	//load maps from config files
	mapdef.scanMaps(path.resolve(config.configpath), tirexpath, function (maps) {
		for (var mapname in maps) {
			var map = new Map(mapname);
			if (map.load(maps[mapname], plugs)) {
				global.logger.debug('[Tileit] Map loaded:', map.toLine());
				caller.maps[mapname] = map;
			} else {
				global.logger.error('[Tileit] Map loading failed, ignored:', mapname);
			}
		}
		cb();
	});
};

Machine.prototype.getMaps = function () {
	var result = [];
	for (var key in this.maps) {
		result.push(this.maps[key]);
	}
	return result;
};

/**
 * map by name
 */

Machine.prototype.getMap = function (name) {
	return this.maps[name];
};

/**
 * get config fot tilethief instances
 */

Machine.prototype.getTileThiefConfig = function () {
	var result = {};
	for (var key in this.maps) {
		var map = this.maps[key];
		result[key] = {
			"url": "http://" + this.config.domain + "/" + key + "/{z}/{x}/{y}." + map.format,
			"filetypes": [map.format],
			"sub": [],
			"zoom": [map.minz, map.maxz],
			"boundaries": null
		}
	}
	return result;
};

/**
 * get config fot preview
 */

Machine.prototype.getPreviewConfig = function (config) {
	var result = {
		prefixpath: config.prefixpath,
		maps: {}
	};
	for (var key in this.maps) {
		var map = this.maps[key];
		result.maps[key] = {
			"name": key,
			"desc": map.desc,
			"attribution": map.attribution,
			"minz": map.minz,
			"maxz": map.maxz,
			"format": map.format,
			"boundaries": null
		}
	}
	return result;
};

exports.Machine = Machine;