#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var express = require("express");
var config = require(__dirname + "/config.js");

var app = express();
app.set('port', config.port || 8080);
app.set('hostname', config.hostname || 'localhost');

if (config.debug) {//} (process.env.NODE_ENV !== 'production') {
	console.debug = console.log;
} else {
	console.debug = function () {
	};
}

var plugs = config.enabled_plugs.map(function (plugname) {
	var Storage = require(__dirname + '/lib/plug_' + plugname + '.js').Storage;
	return new Storage();
});

var stats = {
	num_open_connections: 0,
	requested: 0,
	served: 0,
	notfound: 0
};

app.get('/stats', function (req, res) {
	var stats = {
		general: stats,
		plugs: plugs.map(function (check) {
			return check.getStats();
		})
	};
	res.json(stats);
});

app.get('/', function (req, res) {
	res.send('hi');
});

app.get('/:map/:z/:x/:y.:format', function (req, res) {
	console.debug('[Server] Request: ' + req.url);
//	console.debug(req.headers);
	var avail_checks = plugs.filter(function (check) {
		return check.isKnownMap(req.params.map);
	});
	var store_plugs = plugs.filter(function (plug) {
		return plug.wantsStorage(req.params.map);
	});
	if (avail_checks.length == 0) {
		return res.send(404, 'map not known :.(');
	}
	if (!config["allowed_format"].indexOf(req.params.format) < 0) {
		return res.send(404, 'format invalid :.(');
	}
	var x = parseFloat(req.params.x);
	var y = parseFloat(req.params.y);
	var z = parseFloat(req.params.z);
	if (isNaN(z) || isNaN(x) || isNaN(y)) {
		return res.send(404, 'parameters invalid :.(');
	}
	x = Math.round(x);
	y = Math.round(y);
	z = Math.round(z);
	var limit = Math.pow(2, z) - 1;
//	var mx = x - x % 8;
//	var my = y - y % 8;
//	var limit = 1 << z;
	if ((x < 0) || (y < 0) || (x > limit) || (y > limit)) {
		return res.send(404, 'position out of bounds :.(');
	}
	avail_checks = avail_checks.filter(function (check) {
		return check.hasValidParams(req.params.map, x, y, z, req.params.format);
	});
	if (avail_checks.length == 0) {
		return res.send(404, 'invalid parameters :.(');
	}
	stats.num_open_connections++;
	stats.requested++;
	var check = function (i) {
		console.debug('[Server] Checking Plug: ' + avail_checks[i].stats.name);
		avail_checks[i].getImage(req.params.map, x, y, z, req.params.format, function (err, data) {
			if ((err) || (!data)) {
				if (i < avail_checks.length - 1) {
					check(i + 1);
				} else {
					res.send(503, err || 'internal error :.(');
					stats.notfound++;
					stats.num_open_connections--;
				}
			} else {
				console.debug('[Server] Success, now sending data: ' + avail_checks[i].stats.name);
				if (data.filename) {
					res.status(200).sendfile(data.filename, {maxAge: config.max_age});
				} else {
					res.set('Content-Type', "image/" + data.format);
					res.set('Content-Length', data.buffer.length);
					res.set('Cache-Control', 'public, max-age=' + config.max_age);
					res.send(200, data.buffer);
				}
				stats.served++;
				stats.num_open_connections--;

				if (store_plugs.length > 0) {
					if (data.filename) {
						data.buffer = fs.readFileSync(data.filename);
						data.format = req.params.format;
					}
					for (var j = 0; j < store_plugs.length; j++) {
						if (store_plugs[j] != avail_checks[i]) {
							store_plugs[j].storeImage(req.params.map, x, y, z, data.format, data.buffer, function (err) {

							});
						}
					}
				}
			}
		});
	};

	check(0);
});

http.createServer(app).listen(app.get('port'), app.get('hostname'), function () {
	console.debug('[Server] Listening on ' + app.get('hostname') + ':' + app.get('port'));
});
