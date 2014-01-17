var path = require("path");
var fs = require("fs");

/**
 * A map
 * @constructor
 */

function Map(name, logger) {
	this.name = name;
	this.mapplugs = [];
	this.logger = logger;
}

Map.prototype.storeResult = function (storemapplugs, buffer, treq) {
	var caller = this;
	//storing is async on all backend
	storemapplugs.forEach(function (mapplug) {
		mapplug.plug.storeImage(treq, buffer, mapplug.options, function (err) {
			if (!err)
				caller.logger.debug('[Tileit] Tile stored, map:', caller.name, ', plug:', mapplug.plug.name);
		});
	});
};

Map.prototype.getStoragePaths = function () {
	var caller = this;
	return this.mapplugs.map(function (mapplug) {
		if (typeof mapplug.plug.getStoragePath == 'function') {
			//collecting for maybe storing if any later plug got the image
			return mapplug.plug.getStoragePath(caller.name, mapplug.options);
		}
		return null;
	}).filter(function (storagepath) {
			return (storagepath);
		});
};

Map.prototype.getImage = function (treq) {
	var caller = this;
	var storemapplugs = [];
	var error = null;
	var finish = treq.finish;
	var check = function (i) {
		if (i >= caller.mapplugs.length) {
			finish(error || 'internal error :.(');
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
				caller.logger.debug('[Tileit] Success, now sending data:', mapplug.plug.name, 'map:', caller.name);
				finish(err, buffer);
				caller.storeResult(storemapplugs, buffer, treq);
			}
		};
		//caller.logger.debug('[Tileit] Checking Plug:', mapplug.plug.name, 'map:', caller.name);
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
	for (var key in options.source) {
		var plug = plugs[key];
		if (!plug) {
			this.logger.error('[Tileit] Unknown plug ' + key + ' for map ' + this.name);
			return false;
		}
		var plug_options = options.source[key];
		plug_options.format = plug_options.format || this.format;
		if (typeof plug.validateMapOptions == 'function')
			plug.validateMapOptions(this.name, plug_options);
		this.mapplugs.push({plug: plug, options: plug_options});
	}
	if (this.mapplugs.length == 0) {
		this.logger.error('[Tileit] No plugs for map', this.name);
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

Machine.prototype.init = function (plugs, config, logger, cb) {
	var caller = this;
	this.config = config;
	this.logger = logger;
	//special handling for tirex maps
	if (plugs['tirex']) {
		var tirex = plugs['tirex'];
		for (var key in tirex.maps) {
			var tirex_map = tirex.maps[key];
			var map = new Map(key, logger);
			map.name = tirex_map.name;
			map.maxz = tirex_map.maxz;
			map.minz = tirex_map.minz;
			map.format = 'png';
			map.mapplugs.push({plug: tirex, options: {}});
			caller.logger.debug('[Tileit] Tirex-Map ' + map.toLine());
			this.maps[map.name] = map;
		}
	}

	var importMap = function (obj) {
		for (var mapname in obj) {
			var map = new Map(mapname, logger);
			if (map.load(obj[mapname], plugs)) {
				if (caller.maps[mapname]) {
					caller.logger.info('[Tileit] Map overwritten:', mapname);
				}
				caller.logger.debug('[Tileit] Map loaded:', map.toLine());
				caller.maps[mapname] = map;
			} else {
				caller.logger.error('[Tileit] Map ignored:', mapname);
			}
		}
	};

	//load maps from config files
	var files = fs.readdirSync(path.resolve(config.configpath));
	for (var i = 0; i < files.length; i++) {
		var ext = path.extname(files[i]).toLocaleLowerCase();
		if (ext == '.json') {
			var obj = JSON.parse(fs.readFileSync(path.resolve(config.configpath + '/' + files[i])).toString());
			importMap(obj);
		} else if (ext == '.js') {
			var maps = require(path.resolve(config.configpath + '/' + files[i])).maps;
			if (maps)
				importMap(maps);
		}
	}
	cb();
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
			"url": "http://{s}." + this.config.domain + "/" + key + "/{z}/{x}/{y}." + map.format,
			"sub": ["a", "b"],
			"zoom": [map.minz, map.maxz],
			"boundaries": null
		}
	}
	return result;
};

/**
 * get config fot preview
 */

Machine.prototype.getPreviewConfig = function () {
	var result = {};
	for (var key in this.maps) {
		var map = this.maps[key];
		result[key] = {
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