var fs = require('fs');
var path = require('path');
var dgram = require('dgram');
var async = require("async");
var BaseStorage = require('./plug.js').BaseStorage;
var Stats = require('./stats.js').Stats;
var config = require('../config.js');

// size in bytes of metatile header
var metatile_header_size = 20 + 8 * 64;

// get long value at offset from buffer
Buffer.prototype.getLong = function (offset) {
	return ((this[offset + 3] * 256 + this[offset + 2]) * 256 + this[offset + 1]) * 256 + this[offset];
};

function Maps() {
	this.maps = {};
}

Maps.prototype.find = function (mapname) {
	return this.maps[mapname];
};

/*

 Meta Image Sending

 */

function MetaRequest(map, meta_x, meta_y, z) {
	this.requests = {};
	this.map = map;
	this.meta_x = meta_x;
	this.meta_y = meta_y;
	this.z = z;
	this.handled = false;
}

MetaRequest.prototype.push_request = function (x, y, cb) {
	var fp = [x, y].join('/');
	this.requests[fp] = this.requests[fp] || [];
	this.requests[fp].push({x: x, y: y, cb: cb});
};

MetaRequest.prototype.read_image = function (x, y, fd, cb) {
	var buffer = new Buffer(metatile_header_size);
	fs.read(fd, buffer, 0, metatile_header_size, 0, function (err, bytesRead) {
		if (err || bytesRead !== metatile_header_size) {
			cb('Metatile error :.(');
		} else {
			var pib = 20 + ((y % 8) * 8) + ((x % 8) * 64); // offset into lookup table in header
			var offset = buffer.getLong(pib);
			var size = buffer.getLong(pib + 4);
			var png = new Buffer(size);
			fs.read(fd, png, 0, size, offset, function (err, bytesRead) {
				if (err || bytesRead !== size) {
					cb('Metatile error :.(');
				} else {
					cb(null, size, png, 'png');
				}
			});
		}
	});
};

MetaRequest.prototype.send_image = function (fd, req_array, cb) {
	var req = req_array[0];
	this.read_image(req.x, req.y, fd, function (err, size, buffer, format) {
		req_array.forEach(function (req) {
			if (err) {
				req.cb(err);
			} else {
				req.cb(null, {
					format: format,
					data: buffer
				});
			}
		});
		cb(err);
	});
};

MetaRequest.prototype.getImages = function (fd, cb) {
	var caller = this;

// create a queue object with concurrency 1

	var q = async.queue(function (task, callback) {
		caller.send_image(fd, caller.requests[task.name], function (err) {
			callback();
		});
	}, 1);

	q.drain = function () {
		cb();
	};

	for (var key in this.requests) {
		q.push({name: key}, function (err) {
			if (err) {
				console.error('[Tirex] Error on sending:', key);
			} else {
				console.debug('[Tirex] Finished sending:', key);
			}
		});
	}
};

MetaRequest.prototype.timeout = function () {
	var caller = this;
	var q = async.queue(function (task, callback) {
		caller.requests[task.name].forEach(function (req) {
			req.cb('Tirex Timeout :.(');
			callback();
		});
	}, 3);

	q.drain = function () {
		console.debug('[Tirex] Timeout cancel done');
	};

	for (var key in this.requests) {
		q.push({name: key}, function (err) {
			if (err)
				console.error('[Tirex] Error calling timeout:', key, ':', err);
		});
	}
};

MetaRequest.prototype.getImage = function (cb) {
	var imgfile = this.get_meta_filename(this.map, this.meta_x, this.meta_y, this.z);
	var caller = this;
	fs.open(imgfile, 'r', null, function (err, fd) {
		if (!err) {
			caller.getImages(fd, function () {
				fs.close(fd);
			});
		}
		cb(err);
	});
};

MetaRequest.prototype.get_meta_filename = function (map, x, y, z) {

	function xyz_to_meta_filename(x, y, z) {
		var path_components = [], i, v;

		// make sure we have metatile coordinates
		x -= x % 8;
		y -= y % 8;

		for (i = 0; i <= 4; i++) {
			v = x & 0x0f;
			v <<= 4;
			v |= (y & 0x0f);
			x >>= 4;
			y >>= 4;
			path_components.unshift(v);
		}

		path_components.unshift(z);

		return path_components.join('/') + '.meta';
	}

	return path.join(map.tiledir, xyz_to_meta_filename(x, y, z));
};

/*

 Tirex Communication

 */

function serialize_tirex_msg(msg) {
	var string = '', k;
	for (k in msg) {
		string += k + '=' + msg[k] + '\n';
	}
	return string;
}

function deserialize_tirex_msg(string) {
	var lines = string.split('\n');
	var msg = {}, i;
	for (i = 0; i < lines.length; i++) {
		var line = lines[i].split('=');
		if (line[0] !== '') {
			msg[line[0]] = line[1];
		}
	}
	return msg;
}

function Tirex() {
	this.sock = dgram.createSocket('udp4');
	this.maps = this.load_config();
	var caller = this;
	this.sock.on('message', function (message, rinfo) {
		console.debug('[Tirex] Message: ' + message + ' from ' + rinfo.address + ':' + rinfo.port);
		var msg = deserialize_tirex_msg(message.toString('ascii', 0, rinfo.size));
		if (msg.id[0] !== 'n') {
			return;
		}
		caller.tirex_msg(msg);
	});
	this.sock.on('listening', function (message, rinfo) {
		console.debug('[Tirex] Listening for answer');
	});
	this.sock.on('error', function (message, rinfo) {
		console.error('[Tirex] Error: ' + message + ' from ' + rinfo.address + ':' + rinfo.port);
	});

	this.requests = {};
	this.stats = new Stats("tirex");
}

Tirex.prototype = new BaseStorage();

Tirex.prototype.getStats = function () {
	return this.stats.getStats();
};

Tirex.prototype.load_config = function () {
	var maps = {};
	var renderers = fs.readdirSync(config.tirex.config_dir);
	var i, j;
	for (i = 0; i < renderers.length; i++) {
		var rdir = path.resolve(config.tirex.config_dir, renderers[i]);
		if (fs.statSync(rdir).isDirectory()) {
			var files = fs.readdirSync(rdir);
			for (j = 0; j < files.length; j++) {
				var mapfile = rdir + '/' + files[j];
				var cfg = fs.readFileSync(mapfile).toString();
				var lines = cfg.split('\n');
				var map = {minz: 0, maxz: 0};
				lines.forEach(function (line) {
					if (!line.match('^#') && !line.match('^$')) {
						var kv = line.split('=');
						map[kv[0]] = kv[1];
					}
				});
				console.log('[Tirex] Map ' + map.name + ' [' + map.minz + '-' + map.maxz + '] tiledir=' + map.tiledir);
				maps[map.name] = map;
			}
		}
	}
	return maps;
};

Tirex.prototype.tirex_msg = function (msg) {
	var l = this.fingerprint(msg.map, msg.x, msg.y, msg.z);
	var meta_req = this.requests[l];
	if (meta_req) {
		meta_req.handled = true;
		if (meta_req.timeout_timer) {
			clearTimeout(meta_req.timeout_timer);
		}
		delete this.requests[l];
		meta_req.getImage(function (err) {
			if (!err)
				this.stats.processed(msg.map);
		});
	}
};

var id = 0;

Tirex.prototype.request_tirex = function (map, x, y, z, cb) {
	var meta_x = x - x % 8;
	var meta_y = y - y % 8;
	var l = this.fingerprint(map.name, meta_x, meta_y, z);
	var meta_req = this.requests[l];
	if (meta_req) {
		//there is a matching pending render request, so attach
		meta_req.push_request(x, y, cb);
		return;
	}
	meta_req = new MetaRequest(map, meta_x, meta_y, z);
	meta_req.push_request(x, y, cb);
	this.requests[l] = meta_req;
	var s = serialize_tirex_msg({
		id: 'nodets-' + (id++),
		type: 'metatile_enqueue_request',
		prio: 8,
		map: map.name,
		x: meta_x,
		y: meta_y,
		z: z
	});
	console.debug("[Tirex] message to tirex", s);
	var buf = new Buffer(s);
	this.sock.send(buf, 0, buf.length, config.tirex.master_udp_port, config.tirex.master_udp_host);
	meta_req.timeout_timer = setTimeout(function () {
		if (!meta_req.handled) {
			meta_req.timeout();
		}
	}, config.tirex.timeout);
};

Tirex.prototype.isKnownMap = function (mapname) {
	return this.maps[mapname];
};

Tirex.prototype.hasValidParams = function (mapname, x, y, z, format) {
	var map = this.maps[mapname];
	return(z >= map.minz) && (z <= map.maxz);
};

Tirex.prototype.getImage = function (mapname, x, y, z, format, cb) {
	var map = this.maps[mapname];
	var meta_x = x - x % 8;
	var meta_y = y - y % 8;
	var l = this.fingerprint(map.name, meta_x, meta_y, z);
	if (this.requests[l]) {
		//there is a matching pending render request, so attach
		this.requests[l].push_request(x, y, cb);
		return;
	}
	var caller = this;
	var meta_req = new MetaRequest(map, meta_x, meta_y, z);
	meta_req.push_request(x, y, cb);
	meta_req.getImage(function (err) {
		if (err) {
			caller.request_tirex(map, x, y, z, function (err) {
				if (err) {
					caller.stats.missing(map.name);
				} else {
					caller.stats.served(map.name);
				}
			});
		} else {
			caller.stats.served(map.name);
		}
	});
};

Tirex.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

exports.Storage = Tirex;