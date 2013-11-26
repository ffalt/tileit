var _Memcached = require('memcached');

function Memcached(settings) {
	this.memcached = new _Memcached(settings.hosts, settings.options);
	this.memcached.on('failure', function (details) {
		console.error("[Memcached] Server " + details.server + "went down due to: " + details.messages.join(''))
	});
	this.memcached.on('reconnecting', function (details) {
		console.debug("[Memcached] Total downtime caused by server " + details.server + " :" + details.totalDownTime + "ms")
	});
	this.settings = settings;
}

Memcached.prototype.getImage = function (mapname, x, y, z, format, options, cb) {
	var key = this.tile_key(mapname, x, y, z, format, options);
	this.memcached.get(key, function (err, data) {
		if ((!err) && (data)) {
			cb(null, {
				format: format,
				buffer: data
			});
		} else {
			if (err)
				console.error('[Memcached] Error', err);
			err = (err || 'No memcached data');
			cb(err);
		}
	});
};

Memcached.prototype.storeImage = function (mapname, x, y, z, format, data, options, cb) {
	var key = this.tile_key(mapname, x, y, z, format, options);
	var caller = this;
//	this.memcached.touch(key, this.settings.expiration, function (err) {
//		if (err) {
	console.debug('[Memcached] Storing', key);
	caller.memcached.set(key, data, options.expiration, function (err) {
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

Memcached.prototype.validateMapOptions = function (mapname, options) {
	options.prefix = options.prefix || this.settings.prefix || '';
	options.rev = options.rev || this.settings.rev || '';
	options.expiration = options.expiration || this.settings.expiration;
};

Memcached.prototype.tile_key = function (mapname, x, y, z, format, options) {
	return [options.prefix, mapname, z, x, y, format, options.rev].join('/');
};

exports.Plug = Memcached;
