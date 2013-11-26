#!/usr/bin/env node

var http = require('http');
var express = require("express");
var config = require(__dirname + "/config.js");
var Machine = require(__dirname + "/lib/machine.js").Machine;
var Projections = require(__dirname + "/lib/utils_projections.js").Projections;
var Stats = require(__dirname + '/lib/utils_stats.js').Stats;

if (config.debug) {//} (process.env.NODE_ENV !== 'production') {
	console.debug = console.log;
} else {
	console.debug = function () {
	};
}

var plugs = {};
config.plugs.forEach(function (plugname) {
	var Plug = require(__dirname + '/lib/plug_' + plugname + '.js').Plug;
	plugs[plugname] = new Plug(config[plugname]);
	plugs[plugname].name = plugname;
	plugs[plugname].stats = new Stats();
});

var stats = new Stats();
var lhc = new Machine();


var app = express();
app.set('port', config.port || 8080);
app.set('hostname', config.hostname || 'localhost');

app.get('/stats', function (req, res) {
	var stat = {
		general: stats
	};
	for (var key in plugs) {
		stats[key] = plugs[key].stats;
	}
	res.json(stat);
});

app.get('/', function (req, res) {
	res.send('hi');
});

app.get('/:map/:z/:x/:y.:format/status', function (req, res) {
	var result = {
		map: req.params.map,
		x: req.params.x,
		y: req.params.y,
		z: req.params.z,
		format: req.params.format,
		area: Projections.pixel_bbox(req.params.x, req.params.y),
		point: Projections.pointToLatLng_EPSG3857([req.params.x, req.params.y], req.params.z),
		bounds: Projections.latlng_bbox(req.params.x, req.params.y, req.params.z)
	};
	res.json(result);
});

app.get('/:map/:z/:x/:y.:format', function (req, res) {
	console.debug('[Server] Request: ' + req.url);
//	console.debug(req.headers);

	var map = lhc.getMap(req.params.map);
	if (!map) {
		return res.send(404, 'map not known :.(');
	}

	var format = req.params.format;
	var x = parseFloat(req.params.x);
	var y = parseFloat(req.params.y);
	var z = parseFloat(req.params.z);
	if (isNaN(z) || isNaN(x) || isNaN(y)) {
		return res.send(404, 'invalid parameters :.(');
	}
	x = Math.round(x); //fix for leaflet bug sending floats
	y = Math.round(y);
	z = Math.round(z);
	if (!map.hasValidParams(x, y, z, format)) {
		return res.send(404, 'position/zoom out of bounds :.(');
	}

	stats.validateMapStat(map.name);
	stats.requested(map.name);
	stats.current_inc(map.name);
	map.getImage(x, y, z, format, function (err, result) {
		stats.current_dec(map.name);
		if ((err) || (!result)) {
			res.send(503, err || 'internal error :.(');
			stats.missing(map.name);
		} else {
			if (result.filename) {
				res.status(200).sendfile(result.filename, {maxAge: config.max_age});
			} else {
				res.set('Content-Type', "image/" + result.format);
				res.set('Content-Length', result.buffer.length);
				res.set('Cache-Control', 'public, max-age=' + config.max_age);
				res.send(200, result.buffer);
			}
			stats.served(map.name);
		}
	});
});

lhc.init(plugs, config, function (err) {
	http.createServer(app).listen(app.get('port'), app.get('hostname'), function () {
		console.debug('[Server] Listening on ' + app.get('hostname') + ':' + app.get('port'));
	});
});
