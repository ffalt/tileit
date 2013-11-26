var path = require("path");
var fs = require("fs");

/**
 * A map
 * @constructor
 */
function Map(name) {
	this.name = name;
	this.mapplugs = [];
}

Map.prototype.storeResult = function (storemapplugs, result, x, y, z, format) {
	var caller = this;

	var store = function () {
		//storing is async on all backend
		storemapplugs.forEach(function (mapplug) {
			mapplug.plug.storeImage(caller.name, x, y, z, format, result.buffer, mapplug.options, function (err) {
				if (!err)
					console.debug('[Tileit] Tile stored map', caller.name, 'plug', mapplug.plug.name);
			});
		});
	};

	if (storemapplugs.length > 0) {
		result.format = format;
		if (result.filename) {
			fs.readFile(data.filename, function (err, data) {
				result.buffer = data;
				store();
			});
		} else {
			store();
		}
	}
};

Map.prototype.getImage = function (x, y, z, format, cb) {
	var caller = this;
	var storemapplugs = [];
	var check = function (i) {
		if (i >= caller.mapplugs.length) {
			cb('internal error :.(');
			return;
		}
		var mapplug = caller.mapplugs[i];
		if (typeof mapplug.plug.getImage !== 'function') {
			check(i + 1);
			return;
		}
		//console.debug('[Tileit] Checking Plug:', mapplug.plug.name, 'map:', caller.name);
		mapplug.plug.getImage(caller.name, x, y, z, format, mapplug.options, function (err, result) {
			if ((err) || (!result)) {
				mapplug.plug.stats.missing(caller.name);
				if (typeof mapplug.plug.storeImage == 'function') {
					//collecting for maybe storing if any later plug got the image
					storemapplugs.push(mapplug);
				}
				check(i + 1);
			} else {
				mapplug.plug.stats.served(caller.name);
				console.debug('[Tileit] Success, now sending data:', mapplug.plug.name, 'map:', caller.name);
				cb(err, result);
				caller.storeResult(storemapplugs, result, x, y, z, format);
			}
		});
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
	this.allowed_format = options.allowed_format || ['png'];
	this.options = options;
	for (var key in options.source) {
		var plug = plugs[key];
		if (!plug) {
			console.error('[Tileit] Unknown plug', key, 'for map', this.name);
			return false;
		}
		plug.stats.validateMapStat(this.name);
		var plug_options = options.source[key];
		if (typeof plug.validateMapOptions == 'function')
			plug.validateMapOptions(this.name, plug_options);
		this.mapplugs.push({plug: plug, options: plug_options});
	}
	if (this.mapplugs.length == 0) {
		console.error('[Tileit] No plugs for map', this.name);
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
	return (z >= this.minz) && (z <= this.maxz) && (this.allowed_format.indexOf(format) >= 0);
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
	//special handling for tirex maps
	if (plugs['tirex']) {
		var tirex = plugs['tirex'];
		for (var key in tirex.maps) {
			var tirex_map = tirex.maps[key];
			var map = new Map(key);
			map.name = tirex_map.name;
			map.maxz = tirex_map.maxz;
			map.minz = tirex_map.minz;
			map.allowed_format = ['png'];
			map.mapplugs.push({plug: tirex, options: {}});
			console.debug('[Tileit] Tirex-Map ' + map.toLine());
			this.maps[map.name] = map;
			tirex.stats.validateMapStat(map.name);
		}
	}

	var importMap = function (obj) {
		for (var mapname in obj) {
			var map = new Map(mapname);
			if (map.load(obj[mapname], plugs)) {
				if (caller.maps[mapname]) {
					console.log('[Tileit] Map overwritten', mapname);
				}
				console.debug('[Tileit] Map ' + map.toLine());
				caller.maps[mapname] = map;
			} else {
				console.error('[Tileit] Map ignored:', mapname);
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

/**
 * map by name
 */

Machine.prototype.getMap = function (name) {
	return this.maps[name];
};

exports.Machine = Machine;