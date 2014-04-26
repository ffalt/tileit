#!/usr/bin/env node

var
	fs = require("fs")
	, path = require('path')
	, async = require('async')
	, config = require('../config.js')
	, Machine = require('../lib/machine.js').Machine
	, Projections = require('../lib/utils/projections.js').Projections
	, Logger = require('../lib/utils/logger.js').Logger;

var logger = new Logger(config.log);
global.logger = logger;

var plugs = {};

process.chdir('..');

var lhc = new Machine();

var program = require('commander');

program
	.version('0.0.1')
	.option('-m, --map [names]', 'comma-separated list of maps | e.g. demomap1,demomap2')
	.option('-z, --zoom [levels]', 'comma-separated min/max zoom | e.g. 5 or 5,10, if you need a range use two points 1..5')
	.option('-b, --bbox [coords]', 'comma-separated bounding box | e.g. w, s, e, n')
	.option('-c, --cmd [mode]', '"s": don\' do anything, just print out tile list, "w" warm cache, "d" show disk usage')
	.parse(process.argv);


function TilesCollector() {
	var me = this;

	this.collectmapzoom = function (map, zoom, bbox, cb) {
		var result = [];
		var xybox = [];
		if (!bbox) {
			xybox = Projections.xy_bbox_full(zoom);
		} else {
			console.log(bbox);
//			- `bbox` {Number} bbox in the form `[w, s, e, n]`.
			xybox = Projections.xy_bbox(bbox, zoom, 256);
			if (xybox[0] > xybox[2]) {
				var c = xybox[0];
				xybox[0] = xybox[2];
				xybox[2] = c;
			}
			if (xybox[1] > xybox[3]) {
				var c = xybox[1];
				xybox[1] = xybox[3];
				xybox[3] = c;
			}
			console.log(xybox);
//			lng_lat_bbox, zoom, tilesize
		}
		for (var x = xybox[0]; x <= xybox[2]; x++) {
			for (var y = xybox[1]; y <= xybox[3]; y++) {
				var req = {
					'map': map,
					'x': x,
					'y': y,
					'z': zoom
				};
				result.push(req);
			}
		}
		cb(result);
	};
	//http://odcdn.de:7772/suisse/8/135/91.png

	this.collectmapzooms = function (map, zooms, bbox, cb) {
		var result = [];
		async.forEachSeries(zooms, function (zoom, nextcb) {
			me.collectmapzoom(map, zoom, bbox, function (reqs) {
				result = result.concat(reqs);
				nextcb();
			});
		}, function () {
			cb(result);
		});
	};


//	Map.prototype.getStoragePaths = function () {
//		var caller = this;
//		return this.mapplugs.map(function (mapplug) {
//			if (typeof mapplug.plug.getStoragePath == 'function') {
//				//collecting for maybe storing if any later plug got the image
//				return mapplug.plug.getStoragePath(caller.name, mapplug.options);
//			}
//			return null;
//		}).filter(function (storagepath) {
//			return (storagepath);
//		});
//	};

	this.collect = function (maps, zooms, bbox, cb) {
		var result = [];
		async.forEachSeries(maps, function (map, nextcb) {
//				if (map.getStoragePaths().length == 0) {
//					console.log('map', map.name, 'does not store files');
//					nextcb();
//				} else {
				me.collectmapzooms(map, zooms, bbox, function (reqs) {
					result = result.concat(reqs);
					nextcb();
				});
//				}
			},
			function () {
				cb(result);
			}
		);
	};
}


var mode = 's';
if (program.cmd)
	mode = program.cmd;

if (mode == 's') {
	//don't load the plugs
	var Plug = require(__dirname + '/../lib/template_plug.js').Plug;
	for (var plugname in config.plugs) {
		if (config.plugs[plugname].enabled) {
			plugs[plugname] = new Plug(plugname, config.plugs[plugname]);
		}
	}
} else {
	for (var plugname in config.plugs) {
		if (config.plugs[plugname].enabled) {
			var Plug = require(__dirname + '/../lib/plug_' + plugname + '.js').Plug;
			plugs[plugname] = new Plug(plugname, config.plugs[plugname]);
		}
	}
}
var needmap = (mode != 'd');
var needzoom = (mode != 'd');

function warmcache(reqs, cb) {
	var hasErrors = false;
	var q = async.queue(function (req, callback) {
		var tilekey = [req.map.name, req.z, req.x, req.y].join('/') + '.' + req.map.format;
		req.finish = function (err, data) {
			hasErrors = hasErrors || err || (!data);
			console.log(reqs.indexOf(req) + 1 + '/' + reqs.length, (err || (!data)) ? 'fail' : 'done', tilekey, err ? err : '');
			callback();
		};
		req.map.getImage(req);
	}, 1);
	q.drain = function () {
		cb(hasErrors)
	};
	reqs.forEach(function (req) {
		q.push(req);
	})
}

//function DiskTileUsage(rootpath) {
//	var me = this;
//
//	this.scan = function () {
//		fs.readdir(rootpath, function (err, list) {
//
//		})
//	};
//
//	scan();
//}


function du(maps, zooms, cb) {
//	if (maps.length == 0) {
//		maps = lhc.getMaps();
//	}
//	async.forEachSeries(maps, function (map, nextcb) {
//		var tiledirs = map.getStoragePaths();
//		if (tiledirs.length > 0) {
//			async.forEachSeries(tiledirs, function (tiledir, ncb) {
//				console.log(tiledir);
//				ncb();
//			}, function () {
//				nextcb();
//			});
//		} else
//			nextcb();
//	}, function () {
//		cb();
//	});
}

lhc.init(plugs, config, function () {
	var maps = [];
	var zooms = [];
	var bbox;
	if (program.map && (program.map.length)) {
		var mapnames = program.map.split(',');
		mapnames.forEach(function (mapname) {
			var map = lhc.getMap(mapname);
			if (map) {
				maps.push(map);
			} else {
				console.error('Invalid mapname:', mapname);
				process.exit(1);
			}
		});
	}
	if (needmap && (maps.length == 0)) {
		console.error('Please give me at lease one mapname -m [names]');
		process.exit(1);
	}

	if (program.zoom && (program.zoom.length)) {
		var zooma = program.zoom.split(',');
		zooma.forEach(function (z) {
			var zoom = parseInt(z);
			if ((!isNaN(zoom)) && (z.indexOf('..') < 0)) {
				if (zooms.indexOf(zoom) < 0)
					zooms.push(zoom);
			} else {
				var range = z.split('..');
				if (range.length != 2) {
					console.error('Invalid Zoom Parameter', z);
					process.exit(1);
				} else {
					var mi = Math.min(parseInt(range[0]), parseInt(range[1]));
					var ma = Math.max(parseInt(range[0]), parseInt(range[1]));
					if (isNaN(mi) || isNaN(ma)) {
						console.error('Invalid Zoom Parameter', z);
						process.exit(1);
					}
					for (var i = mi; i <= ma; i++) {
						if (zooms.indexOf(i) < 0)
							zooms.push(i);
					}
				}
			}
		});
	}
	if ((needzoom) && (zooms.length == 0)) {
		console.error('Please give me at lease one zoom level -z [levels]');
		process.exit(1);
	}

	if (program.bbox && (program.bbox.length)) {
		var boxes = program.bbox.split(',');
		boxes = boxes.map(function (f) {
			return parseFloat(f);
		}).filter(function (f) {
			return !isNaN(f);
		});
		if (boxes.length != 4) {
			console.error('Invalid Bbox Parameter', program.bbox);
			process.exit(1);
			return;
		}
		bbox = boxes;
	}

	if (mode == 'd') {
		du(maps, zooms, function () {

		});
		console.log('under construction');
		process.exit(1);
	} else
		var collector = new TilesCollector();
	collector.collect(maps, zooms, bbox, function (reqs) {
		switch (mode) {
			case "s":
				console.log('Just printing out tile adresses');
				reqs.forEach(function (req) {
					var tilekey = [req.map.name, req.z, req.x, req.y].join('/') + '.' + req.map.format;
					console.log(tilekey);
				});
				console.log('Total count:', reqs.length);
				break;
			default:
				console.log('Warming cache');
				warmcache(reqs, function (hasErrors) {
					console.log('Total count:', reqs.length);
					console.log('All done' + (hasErrors ? ' (with errors).' : '.'));
				});
				break;
		}
	});
});