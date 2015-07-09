#!/usr/bin/env node

var
	fs = require("fs")
	, path = require('path')
	, async = require('async')
	, config = require('../config.js')
	, Machine = require('../lib/machine.js').Machine
	, TilesCollector = require('../lib/utils/tiles_collector.js').TilesCollector
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
		console.log('under construction');
		process.exit(1);
	} else {
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
	}
});
