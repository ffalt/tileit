var _Memcached = require('memcached');
var BaseStorage = require('./plug.js').BaseStorage;
var Stats = require('./stats.js').Stats;
var config = require('../config.js');

function MemStore() {
	this.memcached = new _Memcached(config.memcached.host + ':' + config.memcached.port, config.memcached.options);
	this.memcached.on('failure', function (details) {
		console.error("[Memcached] Server " + details.server + "went down due to: " + details.messages.join(''))
	});
	this.memcached.on('reconnecting', function (details) {
		console.debug("[Memcached] Total downtime caused by server " + details.server + " :" + details.totalDownTime + "ms")
	});
	this.stats = new Stats("memcached");
}

MemStore.prototype = new BaseStorage();

MemStore.prototype.getStats = function () {
	return this.stats.getStats();
};

MemStore.prototype.getImage = function (mapname, x, y, z, format, cb) {
	var key = this.tile_key(mapname, x, y, z, format);
	var caller = this;
	this.memcached.get(key, function (err, data) {
		if ((!err) && (data)) {
			caller.stats.served(mapname);
			cb(null, {
				format: format,
				buffer: data
			});
		} else {
			if (err)
				console.error('[Memcached] Error', err);
			err = (err || 'No memcached data');
			caller.stats.missing(mapname);
			cb(err);
		}
	});
};

MemStore.prototype.tile_key = function (mapname, x, y, z, format) {
	return [config.memcached.prefix, mapname, z, x, y, format, config.memcached.rev].join('/');
};

MemStore.prototype.wantsStorage = function (mapname) {
	return true;
};

MemStore.prototype.storeImage = function (mapname, x, y, z, format, data, cb) {
	var key = this.tile_key(mapname, x, y, z, format);
	var caller = this;
//	this.memcached.touch(key, config.memcached.expiration, function (err) {
//		if (err) {
	console.debug('[Memcached] Storing', key);
	caller.memcached.set(key, data, config.memcached.expiration, function (err) {
		if (!err) {
			console.debug('[Memcached] Ok, stored', key);
		} else {
			console.error('[Memcached] Error on stored:', key);
			cb(err);
		}
	});
//		} else {
//			cb();
//		}
//	});
};

exports.Storage = MemStore;
