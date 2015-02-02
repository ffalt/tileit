var path = require('path');
var winston = require('winston');

function Logger(settings) {
	var me = this;
	this._info = new (winston.Logger)({
		transports: [
			//new (winston.transports.Console)(),
			new (winston.transports.File)({filename: path.resolve(settings.path) + '/tileit.log'})
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
	var stat_inc_internal = empty;
	var stat_dec_internal = empty;

	var logrender_internal = empty;

	me.stats = {};

	if (settings.levels.indexOf("stats") >= 0) {
		stat_inc_internal = function (counter_name, amount) {
			me.stats[counter_name] = (me.stats[counter_name] || 0) + (amount || 1);
		};
		stat_dec_internal = function (counter_name, amount) {
			me.stats[counter_name] = (me.stats[counter_name] || 0) - (amount || 1);
		};
		logrender_internal = function (map, req, start, end) {
			var tilecount = req.metatile ? (req.metatile.metaWidth * req.metatile.metaHeight) : 1;
			stat_inc_internal('rendered', tilecount);
			stat_inc_internal('render_duration', (end.valueOf() - start.valueOf()));
		};
	}
	this.debug = function (d) {
		debug_internal(d);
	};
	this.logfail = function (req, err) {
		logfail_internal(req, err);
		stat_inc_internal('failed');
	};
	this.logrequest = function (req) {
		me.debug('[Server] Request', req.url);
		stat_inc_internal('total');
		stat_inc_internal('queue');
	};
	this.logrequestend = function (req) {
		stat_dec_internal('queue');
	};
	this.logtile = function (req, treq, buffer) {
		logtile_internal(req, treq, buffer);
	};
	this.logrender = function (map, req, start, end) {
		logrender_internal(map, req, start, end);
	};

	if (settings.levels.indexOf("debug") >= 0) {
		this._debug = new (winston.Logger)({
			transports: [
//			new (winston.transports.Console)(),
				new (winston.transports.File)({filename: path.resolve(settings.path) + '/tileit_debug.log'})
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
				new (winston.transports.File)({filename: path.resolve(settings.path) + '/tileit_tiles.log'})
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