#!/usr/bin/env node

var express = require("express")
	, path = require("path")
	, async = require("async")
	, config = require(__dirname + "/config.js")
	, Machine = require(__dirname + "/lib/machine.js").Machine
	, Projections = require(__dirname + "/lib/utils/projections.js").Projections
	, Logger = require(__dirname + '/lib/utils/logger.js').Logger;

var logger = new Logger(config.log);

var plugs = {};

var lhc = new Machine();

var program = require('commander');

program
	.version('0.0.1')
	.option('-m, --map [names]', 'comma-separated list of maps | e.g. demomap1,demomap2')
	.option('-z, --zoom [levels]', 'comma-separated min/max zoom | e.g. 5 or 5,10, if you need a range use two points 1..5')
	.option('-b, --bbox [coords]', 'comma-separated bounding box | e.g. nw-lat,nw-lng,se-lat,se-lng ')
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
			xybox = Projections.xy_bbox(bbox, zoom);
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

	this.collect = function (maps, zooms, bbox, cb) {
		var result = [];
		async.forEachSeries(maps, function (map, nextcb) {
				if (map.getStoragePaths().length == 0) {
					console.log('map', map.name, 'does not store files');
					nextcb();
				} else {
					me.collectmapzooms(map, zooms, bbox, function (reqs) {
						result = result.concat(reqs);
						nextcb();
					});
				}
			},
			function () {
				cb(result);
			}
		);
	};
}

var collector = new TilesCollector();

var mode = 'w';
if (program.cmd)
	mode = program.cmd;

if (mode == 's') {
	//don't load the plugs
	var Plug = require(__dirname + '/lib/template_plug.js').Plug;
	config.plugs.forEach(function (plugname) {
		plugs[plugname] = new Plug(plugname, {}, logger);
	});
} else {
	config.plugs.forEach(function (plugname) {
		var Plug = require(__dirname + '/lib/plug_' + plugname + '.js').Plug;
		plugs[plugname] = new Plug(plugname, config[plugname], logger);
	});
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

function du(maps, zooms, cb) {
	if (maps.length == 0) {
		maps = lhc.getMaps();
	}
	async.forEachSeries(maps, function (map, nextcb) {
		var tiledirs = map.getStoragePaths();
		if (tiledirs.length > 0) {
			async.forEachSeries(tiledirs, function (tiledir, ncb) {
				console.log(tiledir);
				ncb();
			}, function () {
				nextcb();
			});
		} else
			nextcb();
	}, function () {
		cb();
	});
}

lhc.init(plugs, config, logger, function () {
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
	} else
		collector.collect(maps, zooms, bbox, function (reqs) {
			switch (mode) {
				case "s":
					reqs.forEach(function (req) {
						var tilekey = [req.map.name, req.z, req.x, req.y].join('/') + '.' + req.map.format;
						console.log(tilekey);
					});
					console.log('Total count:', reqs.length);
					break;
				default:
					warmcache(reqs, function (hasErrors) {
						console.log('Total count:', reqs.length);
						console.log('All done' + (hasErrors ? ' (with errors).' : '.'));
					});
					break;
			}
		});
});