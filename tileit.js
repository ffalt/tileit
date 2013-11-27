#!/usr/bin/env node

var http = require('http');
var express = require("express");
var config = require(__dirname + "/config.js");
var Machine = require(__dirname + "/lib/machine.js").Machine;
var Projections = require(__dirname + "/lib/utils_projections.js").Projections;
var Logger = require(__dirname + '/lib/utils_logger.js').Logger;

var logger = new Logger(config.log);

//var spawn = require('child_process').spawn;

var plugs = {};
config.plugs.forEach(function (plugname) {
	var Plug = require(__dirname + '/lib/plug_' + plugname + '.js').Plug;
	plugs[plugname] = new Plug(plugname, config[plugname], logger);
});

var lhc = new Machine();


var app = express();
app.set('port', config.port || 8080);
app.set('hostname', config.hostname || 'localhost');
app.set('title', 'tileit');
app.disable('x-powered-by');

//app.use(function (err, req, res, next) {
//	logger.error(err.stack);
//	res.send(555, 'Something broke!');
//});
//var count = 0;
//app.use(function (req, res, next) {
//	logger.info('%s %s', req.method, req.url);
//	next();
//});

app.get('/', function (req, res) {
	res.send('hi');
});

app.get('/tilethief', function (req, res) {
	res.json(lhc.getTileThiefConfig());
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
	logger.debug('[Server] Request', req.url);

	var map = lhc.getMap(req.params.map);
	if (!map) {
		logger.logfail(req, 'map not known');
		return res.send(404, 'map not known :.(');
	}

	var format = req.params.format.toLowerCase();
	var x = parseFloat(req.params.x);
	var y = parseFloat(req.params.y);
	var z = parseFloat(req.params.z);
	if (isNaN(z) || isNaN(x) || isNaN(y)) {
		logger.logfail(req, 'invalid parameters');
		return res.send(404, 'invalid parameters :.(');
	}
	x = Math.round(x); //fix for leaflet bug sending floats
	y = Math.round(y);
	z = Math.round(z);
	if (!map.hasValidParams(x, y, z, format)) {
		logger.logfail(req, 'position/zoom out of bounds');
		return res.send(404, 'position/zoom out of bounds :.(');
	}

	var aborted = false;

//todo: req.connection is reused, so listener is possible memoryleak
//	req.connection.on('close', function () {
//		aborted = true;
//	});
//	req.socket.on('error', function (err) {
//		aborted = true;
////		console.log('e', err);
//	});

	var treq = {
		mapname: map.name, x: x, y: y, z: z, format: format,
		finish: function (err, buffer) {
			if (aborted) {
				logger.logfail(req, 'aborted');
			} else if ((err) || (!buffer)) {
				res.send(503, err || 'internal error :.(');
				logger.logfail(req, err || 'internal error');
			} else {
				res.set('Content-Type', "image/" + format);
				res.set('Content-Length', buffer.length);
				res.set('Cache-Control', 'public, max-age=' + config.max_age);
				res.send(200, buffer);
				logger.logtile(req, treq, buffer);
			}
		}
	};

	map.getImage(treq);
})
;

lhc.init(plugs, config, logger, function (err) {
	http.createServer(app).listen(app.get('port'), app.get('hostname'), function () {
		logger.info('[Server] TileIt running on ' + app.get('hostname') + ':' + app.get('port'));
	});
});
