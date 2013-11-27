var path = require('path');
var winston = require('winston');

function Logger(settings) {
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
	this.debug = empty;
	this.logfail = empty;
	this.logtile = empty;

	if (settings.levels.indexOf("debug") >= 0) {
		this._debug = new (winston.Logger)({
			transports: [
//			new (winston.transports.Console)(),
				new (winston.transports.File)({ filename: path.resolve(settings.path) + '/tileit_debug.log' })
			]
		});
		this.debug = this._debug.info;
	}

	if (settings.levels.indexOf("warn") >= 0) {
		this.logfail = function (req, err) {
			var logobj = {
				"err": err,
				"url": req.url,
				"user-agent": req.headers["user-agent"],
				"referer": req.headers["referer"]
			};
			this.warn('request', logobj);
		};
	}

	if (settings.levels.indexOf("tiles") >= 0) {
		this._log = new (winston.Logger)({
			transports: [
//			new (winston.transports.Console)(),
				new (winston.transports.File)({ filename: path.resolve(settings.path) + '/tileit_tiles.log' })
			]
		});
		this.logtile = function (req, treq, buffer) {
			var logobj = {
				map: treq.mapname,
				x: treq.x, y: treq.y, z: treq.z,
				plug: treq.plugname,
				size: buffer.length,
				format: treq.format,
				"user-agent": req.headers["user-agent"],
				referer: req.headers["referer"]
			};
			this._log.info('tile', logobj);
		};
	}

}

exports.Logger = Logger;