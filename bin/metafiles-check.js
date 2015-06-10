var path = require('path')
	, async = require('async')
	, fs = require('fs')
	, dir = require('node-dir')
	, config = require('../config.js')
	, Machine = require('../lib/machine.js').Machine
	, MetaTile = require('../lib/utils/metatile.js').MetaTile
	, Logger = require('../lib/utils/logger.js').Logger;

var logger = new Logger({
	"path": "./check-logs",
	"levels": ["info", "warn", "error", "tiles", "debug"]
});

process.chdir('..');

global.logger = logger;

var plugs = {};
for (var plugname in config.plugs) {
	if ((['mapnik', 'metafile'].indexOf(plugname) >= 0 ) && (config.plugs[plugname].enabled)) {
		var Plug = require(__dirname + '/../lib/plug_' + plugname + '.js').Plug;
		plugs[plugname] = new Plug(plugname, config.plugs[plugname]);
	}
}

var checkpaths = [];
var lhc = new Machine();
lhc.init(plugs, config, function () {
	for (var m in lhc.maps) {
		var map = lhc.maps[m];
		map.mapplugs.forEach(function (p) {
			if ((p.plug.name == 'mapnik') && (p.options.metaTileCount > 1)) {
				if (p.options.tilesPath) {
					checkpaths.push({path: p.options.tilesPath, options: p.options});
				}
			}
		});
	}
});

function coordsFromMetaFilename(filename) {
	var path_components = filename.split('/');
	path_components[path_components.length - 1] = path.basename(path_components[path_components.length - 1], '.meta');
	var tile = {
		map: path_components[path_components.length - 7],
		z: path_components[path_components.length - 6],
		x: 0,
		y: 0,
		filename: filename,
		valid: true
	};
	path_components = path_components.slice(path_components.length - 5, path_components.length);
	path_components.forEach(function (val) {
		if (val < 0 || val > 255) tile.valid = false;
		else {
			tile.x <<= 4;
			tile.y <<= 4;
			tile.x |= (val & 0xf0) >> 4;
			tile.y |= (val & 0x0f);
		}
	});
	return tile;
}

var errors = [];

var checkfile = function (filename, o, next) {
	var t = coordsFromMetaFilename(filename);
	if (!t.valid) return console.log('invalid metatile filename', filename);
	var mtile = new MetaTile(t.x, t.y, t.z, o.options);
	mtile.openFile(o.path, function (err, mfile) {
		if (err) return console.log(err);
		async.eachSeries(mtile.getTiles(), function (tile, cb) {
			//console.log(t.map, tile);
			mtile.readFileTile(tile, mfile, function (err, buffer) {
				if (err) {
					errors.push(err);
					return console.error(err);
				}
				cb();
			});
		}, function () {
			mtile.closeFile(mfile);
			next();
		});
	});
};

var checkfiles = function (o, next) {
	var q = async.queue(function (filename, next) {
		checkfile(filename, o, next);
	});
	q.drain = next;
	q.push(o.files);
};

var checkpath = function (o, next) {
	console.log('checking folder', o.path);
	if (!fs.existsSync(o.path)) return next();
	dir.paths(o.path, function (err, paths) {
		if (err) {
			errors.push(err);
			return console.error(err);
		}
		o.files = paths.files.filter(function (filename) {
			return path.extname(filename) == '.meta';
		});
		checkfiles(o, next);
	});
};

var q = async.queue(function (o, next) {
	checkpath(o, next);
}, 1);
q.drain = function () {
	console.log('-------------------------------');
	if (errors.length)
		console.log(errors);
	else
		console.log('No metatilefile errors found');
	console.log('-------------------------------');
	console.log('done');
};
q.push(checkpaths);


