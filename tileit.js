#!/usr/bin/env node

var express = require("express")
	, path = require("path")
	, fs = require("fs")
	, config = require(__dirname + "/config.js")
	, Machine = require(__dirname + "/lib/machine.js").Machine
	, Projections = require(__dirname + "/lib/utils/projections.js").Projections
	, Logger = require(__dirname + '/lib/utils/logger.js').Logger
	;

var logger = new Logger(config.log);

global.logger = logger;

var plugs = {};
for (var plugname in config.plugs) {
	if (config.plugs[plugname].enabled) {
		var Plug = require(__dirname + '/lib/plug_' + plugname + '.js').Plug;
		plugs[plugname] = new Plug(plugname, config.plugs[plugname]);
	}
}

var lhc = new Machine();

var app = express();
app.set('port', config.port || 8080);
app.set('hostname', config.hostname || 'localhost');
app.set('title', 'tileit');
app.disable('x-powered-by');
if (config.preview) {
	app.get('/_preview', function (req, res) {
		res.redirect('/_preview/map.htm');
	});
	app.get('/_preview/maps.json', function (req, res) {
		res.json(lhc.getPreviewConfig(config));
	});
	app.use('/_preview', express.static(path.resolve(config.preview)));
}

app.get(config.prefixpath + '/', function (req, res) {
	res.send('hi');
});

app.get(config.prefixpath + '/_tilethief', function (req, res) {
	res.json(lhc.getTileThiefConfig());
});

app.get(config.prefixpath + '/:map/:z/:x/:y.:format/status', function (req, res) {
	var result = {
		map: req.params.map,
		x: req.params.x,
		y: req.params.y,
		z: req.params.z,
		format: req.params.format,
		area: Projections.pixel_bbox(req.params.x, req.params.y),
		bounds: Projections.latlng_bbox(req.params.x, req.params.y, req.params.z)
	};
	res.json(result);
});

app.get(config.prefixpath + '/:map/:z/:x/:y.:format', function (req, res) {
	global.logger.logrequest(req);

	var map = lhc.getMap(req.params.map);
	if (!map) {
		global.logger.logfail(req, 'map not known');
		return res.send(404, 'map not known :.(');
	}

	var format = req.params.format.toLowerCase();
	var x = parseFloat(req.params.x);
	var y = parseFloat(req.params.y);
	var z = parseFloat(req.params.z);
	if (isNaN(z) || isNaN(x) || isNaN(y)) {
		global.logger.logfail(req, 'invalid parameters');
		return res.send(404, 'invalid parameters :.(');
	}
	x = Math.round(x); //fix for leaflet bug sending floats
	y = Math.round(y);
	z = Math.round(z);
	if (!map.hasValidParams(x, y, z, format)) {
		global.logger.logfail(req, 'invalid parameters');
		return res.send(404, 'invalid parameters :.(');
	}

	var aborted = false;

//todo: not aborting yet. req.connection is reused, so listener is possible memoryleak
//	req.connection.on('close', function () {
//		aborted = true;
//	});
//	req.socket.on('error', function (err) {
//		aborted = true;
////		console.log('e', err);
//	});

	var formats = {
		'png': 'image/png',
		'jpeg': 'image/jpeg',
		'svg': 'image/svg+xml',
		'pdf': 'application/pdf',
		'json': 'text/x-json',
		'utf': 'text/x-json',
		'pbf': 'application/x-protobuf'
	};

	var treq = {
		mapname: map.name, x: x, y: y, z: z, format: format,
		finish: function (err, buffer) {
			global.logger.logrequestend(req);
			if (aborted) {
				global.logger.logfail(req, 'aborted');
			} else if ((err) || (!buffer)) {
				res.send(503, err || 'internal error :.(');
				global.logger.logfail(req, err || 'internal error');
			} else {
				var content_type = formats[treq.format] || ('image/' + format);
				res.set('Content-Type', content_type);
				res.set('Content-Length', buffer.length);
				res.set('Cache-Control', 'public, max-age=' + config.max_age);
				res.send(200, buffer);
				global.logger.logtile(req, treq, buffer);
			}
		}
	};

	map.getImage(treq);
});

lhc.init(plugs, config, function (err) {
	if (config.hasOwnProperty("socket")) {
		var sockfile = path.resolve(config.socket);
		// check if socket exists
		fs.exists(sockfile, function (ex) {
			// delete socket on existence
			if (ex) fs.unlinkSync(sockfile);
			// set umask to create readable socket
			var umask = process.umask(0000);
			app.listen(sockfile, function () {
				global.logger.info('[Server] TileIt running on socket ' + sockfile);
				// reset umask
				process.umask(umask);
			});
		});
	} else {
		app.listen(app.get('port'), app.get('hostname'), function () {
			global.logger.info('[Server] TileIt running on ' + app.get('hostname') + ':' + app.get('port'));
		});
	}
});

/* heartbeat */
if (config.hasOwnProperty("nsa")) {
	var nsa = require("nsa");
	var heartbeat = new nsa(config.nsa).start();
	var timeout;
	var logstats = function () {
		var o = {};
		o["tiles"] = global.logger.stats.total || 0;
		if (global.logger.stats.queue > 0) {
			o["tiles"] = o["tiles"] + ' (' + global.logger.stats.queue + ')';
		}
		if (global.logger.stats.rendered !== undefined) {
			o["rendered"] = global.logger.stats.rendered;
			var s = ((global.logger.stats.render_duration || 0) / (global.logger.stats.rendered || 1));
			if (s < 100) s = Math.round(s) + 'ms';
			else s = (s / 1000).toFixed(2) + 's';
			o["⌀ render"] = s;
		}
		heartbeat.leak(o);
		timeout = setTimeout(logstats, 1000);
	};
	logstats();

	process.on("SIGINT", function () {
		clearTimeout(timeout);
		heartbeat.end(function () {
			process.exit();
		});
	});
}
