var _Memcached = require('memcached');

/**
 * The Memcached Plug for loading and storing tiles in Memcached
 * http://www.memcached.org/
 * Memcached-Key:
 * [prefix]/[mapname]/[z]/[x]/[y]/[format]/[revision]
 *
 * @param settings from config.js
 * @constructor
 */

function Memcached(name, settings, logger) {
	this.name = name;
	this.settings = settings;
	this.logger = logger;
	this.memcached = new _Memcached(settings.hosts, settings.options);
	this.memcached.on('failure', function (details) {
		logger.error("[Memcached] Server " + details.server + "went down due to: " + details.messages.join(''))
	});
	this.memcached.on('reconnecting', function (details) {
		logger.debug("[Memcached] Total downtime caused by server " + details.server + " :" + details.totalDownTime + "ms")
	});
}

/**
 * compile the memcached key and request the data
 */

Memcached.prototype.getImage = function (treq, options) {
	var caller = this;
	var key = this.tile_key(treq.mapname, treq.x, treq.y, treq.z, treq.format, options);
	this.memcached.get(key, function (err, data) {
		if ((!err) && (data)) {
			treq.finish(null, data);
		} else {
			if (err)
				caller.logger.error('[Memcached] Error', err);
			treq.finish((err || 'No memcached data'));
		}
	});
};

/**
 * compile the memcached key and store the data
 */

Memcached.prototype.storeImage = function (treq, data, options, cb) {
	var key = this.tile_key(treq.mapname, treq.x, treq.y, treq.z, treq.format, options);
	var caller = this;
//	this.memcached.touch(key, this.settings.expiration, function (err) {
//		if (err) {
	caller.logger.debug('[Memcached] Storing', key);
	caller.memcached.set(key, data, options.expiration, function (err) {
		if (!err) {
			caller.logger.debug('[Memcached] Ok, stored', key);
		} else {
			caller.logger.error('[Memcached] Error on stored:', key);
			cb(err);
		}
	});
//		} else {
//			cb();
//		}
//	});
};

/**
 * set the default options if needed for a map
 */

Memcached.prototype.validateMapOptions = function (mapname, options) {
	options.prefix = options.prefix || this.settings.prefix || '';
	options.rev = options.rev || this.settings.rev || '';
	options.expiration = options.expiration || this.settings.expiration;
};

/**
 * compile the memcached key
 */

Memcached.prototype.tile_key = function (mapname, x, y, z, format, options) {
	return [options.prefix, mapname, z, x, y, format, options.rev].join('/');
};

exports.Plug = Memcached;
