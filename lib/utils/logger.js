var path = require('path');
var winston = require('winston');

//global.statsd.increment('tileit.aborted');
//global.statsd.increment('tileit.failed');
//global.statsd.increment('tileit.served');

function Logger(settings) {
	var me = this;
	this._info = new (winston.Logger)({
		transports: [
//			new (winston.transports.Console)({ level: 'error' }),
			new (winston.transports.Console)(),
			new (winston.transports.File)({ filename: path.resolve(settings.path) + '/tileit.log' })
		]
	});
//	"log": ["", "warn", "error", "tiles", "debug"],

	var empty = function () {
	};

	this.info = settings.levels.indexOf("info") >= 0 ? this._info.info : empty;
	this.warn = settings.levels.indexOf("warn") >= 0 ? this._info.warn : empty;
	this.error = settings.levels.indexOf("error") >= 0 ? this._info.error : empty;
	var debug_internal = empty;
	var logfail_internal = empty;
	var logtile_internal = empty;
	var incstat_internal = empty;


	if (settings.levels.indexOf("statsd") >= 0) {
		var StatsD = require('node-statsd').StatsD;
		me.statsd = new StatsD();
		incstat_internal = function (counter_name) {
			me.statsd.increment(counter_name);
		};
	}
	this.debug = function (d) {
		debug_internal(d);
	};
	this.logfail = function (req, err) {
		logfail_internal(req, err);
		incstat_internal('tileit.failed');
	};
	this.logrequest = function (req) {
		me.debug('[Server] Request', req.url);
		incstat_internal('tileit.requests');
	};
	this.logtile = function (req, treq, buffer) {
		logtile_internal(req, treq, buffer);
		incstat_internal('tileit.served');
	};

	if (settings.levels.indexOf("debug") >= 0) {
		this._debug = new (winston.Logger)({
			transports: [
//			new (winston.transports.Console)(),
				new (winston.transports.File)({ filename: path.resolve(settings.path) + '/tileit_debug.log' })
			]
		});
		debug_interal = this._debug.info;
	}

	if (settings.levels.indexOf("warn") >= 0) {
		logfail_internal = function (req, err) {
			var logobj = {
				"err": err,
				"url": req.url,
				"user-agent": req.headers["user-agent"],
				"referer": req.headers["referer"]
			};
			me.warn('request', logobj);
		};
	}

	if (settings.levels.indexOf("tiles") >= 0) {
		me._log = new (winston.Logger)({
			transports: [
//			new (winston.transports.Console)(),
				new (winston.transports.File)({ filename: path.resolve(settings.path) + '/tileit_tiles.log' })
			]
		});
		logtile_internal = function (req, treq, buffer) {
			var logobj = {
				map: treq.mapname,
				x: treq.x, y: treq.y, z: treq.z,
				size: buffer.length,
				format: treq.format,
				"user-agent": req.headers["user-agent"],
				referer: req.headers["referer"]
			};
			me._log.info(treq.plugname, logobj);
		};
	}

}

exports.Logger = Logger;