var fs = require('fs');
var path = require('path');
var async = require("async");
try {
	var unix = require('unix-dgram');
} catch (e) {
	console.log('[Tirex] Are you running this on unix?');
}

/**
 * Metatile-Handling
 * http://wiki.openstreetmap.org/wiki/Tirex/Overview#Metatiles
 */

// size in bytes of metatile header
var metatile_header_size = 20 + 8 * 64;

// get long value at offset from buffer
Buffer.prototype.getLong = function (offset) {
	return ((this[offset + 3] * 256 + this[offset + 2]) * 256 + this[offset + 1]) * 256 + this[offset];
};

/**
 * bundles requests for tiles from a meta-tile
 **/

function MetaRequest(map, meta_x, meta_y, z) {
	this.requests = {};
	this.map = map;
	this.meta_x = meta_x;
	this.meta_y = meta_y;
	this.z = z;
	this.handled = false;
}

/**
 * bundle request for a tile in the request-hash
 **/

MetaRequest.prototype.push_request = function (x, y, cb) {
	var fp = [x, y].join('/');
	this.requests[fp] = this.requests[fp] || [];
	this.requests[fp].push({x: x, y: y, cb: cb});
};

/**
 * read a tile from metatile file
 **/

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

/**
 * send a tile to all requests for it
 **/

MetaRequest.prototype.send_image = function (fd, req_array, cb) {
	var req = req_array[0];
	this.read_image(req.x, req.y, fd, function (err, size, buffer, format) {
		req_array.forEach(function (req) {
			if (err) {
				req.cb(err);
			} else {
				req.cb(null, {
					format: format,
					buffer: buffer
				});
			}
		});
		cb(err);
	});
};

/**
 * handle all requests for tiles on this metatile
 **/

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

/**
 * timeout all requests for tiles on this metatile
 **/

MetaRequest.prototype.timeout = function () {
	var caller = this;
	var q = async.queue(function (task, callback) {
		caller.requests[task.name].forEach(function (req) {
			req.cb('Tirex Timeout :.(');
		});
		callback();
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

/**
 * try reading a meta-tile
 **/

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

/**
 * compile the matching metatile file name by slippy map parameters
 **/

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

/**
 * The Tirex Plug for translate slippy request for tiles from metatiles rendered by Tirex
 * http://wiki.openstreetmap.org/wiki/Tirex
 *
 * @param settings from config.js
 * @constructor
 */

function Tirex(settings) {
	var caller = this;
	this.settings = settings;
	this.unique_msg_id = 0;
	try {
		this.sock = unix.createSocket('unix_dgram', function (message, rinfo) {
			var s = message.toString('ascii', 0, rinfo.size);
			console.debug('[Tirex] Message recieved: ' + s);
			var msg = caller.deserialize_tirex_msg(s);
			if (msg.id[0] == 'n') {
				caller.tirex_msg(msg);
			}
		});
		this.sock.bind('');
	} catch (e) {
		console.log('[Tirex] Could not connect to Tirex Master');
	}
	this.maps = this.load_config();
	this.requests = {};
}

/**
 * handle with matching metatile request
 */

Tirex.prototype.getImage = function (mapname, x, y, z, format, options, cb) {
	var map = this.maps[mapname];
	var meta_x = x - x % 8;
	var meta_y = y - y % 8;
	var l = this.fingerprint(map.name, meta_x, meta_y, z);
	if (this.requests[l]) {
		//there is a matching pending render request, so attach
		console.debug('[Tirex] tile request queued since a request for this meta already running');
		this.requests[l].push_request(x, y, cb);
		return;
	}
	var caller = this;
	var meta_req = new MetaRequest(map, meta_x, meta_y, z);
	meta_req.push_request(x, y, cb);
	this.requests[l] = meta_req;
	meta_req.getImage(function (err) {
		if (err) {
			//could not be loaded from metatile -> request rendering
			caller.request_tirex(meta_req);
		} else {
			delete caller.requests[l];
		}
	});
};

/**
 * Tirex Msg Object -> String
 */

Tirex.prototype.serialize_tirex_msg = function (msg) {
	var string = '', k;
	for (k in msg) {
		string += k + '=' + msg[k] + '\n';
	}
	return string;
};

/**
 * String -> Tirex Msg Object
 */

Tirex.prototype.deserialize_tirex_msg = function (string) {
	var lines = string.split('\n');
	var msg = {}, i;
	for (i = 0; i < lines.length; i++) {
		var line = lines[i].split('=');
		if (line[0] !== '') {
			msg[line[0]] = line[1];
		}
	}
	return msg;
};

/**
 *  load Tirex map config files
 */

Tirex.prototype.load_config = function () {
	var maps = {};
	var renderers = fs.readdirSync(path.resolve(this.settings.config_dir));
	var i, j;
	for (i = 0; i < renderers.length; i++) {
		var rdir = path.resolve(this.settings.config_dir, renderers[i]);
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
				maps[map.name] = map;
			}
		}
	}
	return maps;
};

/**
 * handle tirex msg
 */

Tirex.prototype.tirex_msg = function (msg) {
	var caller = this;
	var l = this.fingerprint(msg.map, msg.x, msg.y, msg.z);
	var meta_req = this.requests[l];
	if (meta_req) {
		delete this.requests[l];
		this.stats.current_dec(msg.map);
		//clear timeout timer
		meta_req.handled = true;
		if (meta_req.timeout_timer) {
			clearTimeout(meta_req.timeout_timer);
		}
		console.debug('[Tirex] Tirex req handled');
		//try reading the requested tile from the metatile
		meta_req.getImage(function (err) {
			if (!err)
				caller.stats.processed(msg.map);
		});
	}
};

/**
 * create key for metatile-requests-hash
 */

Tirex.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

/**
 * compile a tirex-render-command-msg and send it with timeout
 */

Tirex.prototype.request_tirex = function (meta_req) {
	var msg = {
		id: 'nodets-' + (this.unique_msg_id++),
		type: 'metatile_enqueue_request',
		prio: 8,
		map: meta_req.map.name,
		x: meta_req.meta_x,
		y: meta_req.meta_y,
		z: meta_req.z
	};
	this.stats.current_inc(msg.map);
	var s = this.serialize_tirex_msg(msg);
	console.debug("[Tirex] message to tirex:", JSON.stringify(msg));
	var buf = new Buffer(s);
	this.sock.send(buf, 0, buf.length, this.settings.master_socket, function (err) {
		if (err) {
			console.error('[Tirex] Error sending to Tirex', err);
		}
	});
	var caller = this;
	meta_req.timeout_timer = setTimeout(function () {
		if (!meta_req.handled) {
			var l = caller.fingerprint(meta_req.map.name, meta_req.meta_x, meta_req.meta_y, meta_req.z);
			delete caller.requests[l];
			meta_req.timeout();
			this.stats.current_dec(msg.map);
		}
	}, this.settings.timeout);
};

exports.Plug = Tirex;