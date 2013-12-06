var fs = require('fs');
var path = require('path');
var async = require("async");
var MetaTile = require("./utils/metatile.js").MetaTile;
var MetaTileRequest = require("./utils/metatile_request.js").MetaTileRequest;

try {
	var unix = require('unix-dgram');
} catch (e) {
}

var metatileoptions = {
	metatile: 8,
	tileSize: 256
};

/**
 * The Tirex Plug for translate slippy request for tiles from metatiles rendered by Tirex
 * http://wiki.openstreetmap.org/wiki/Tirex
 *
 * @param settings from config.js
 * @constructor
 */

function Tirex(name, settings, logger) {
	var caller = this;
	if (!unix) {
		caller.logger.error('[Tirex] Could unix-dgram package not loaded', e);
		throw new Error('Tirex plug requires unix-dgram to be installed:\nnpm install unix-dgram');
	}
	this.name = name;
	this.settings = settings;
	this.logger = logger;
	this.unique_msg_id = 0;
	this.maps = this.load_config();
	this.requests = {};

	this.q = async.queue(function (task, callback) {
		caller.request_tirex(task.meta_req);
		callback();
	}, 10);
}

Tirex.prototype.connect = function (cb) {
	if (this.sock) {
		cb(null, this.sock);
		return;
	}
	var caller = this;
	try {
		var sock = unix.createSocket('unix_dgram', function (message, rinfo) {
			var s = message.toString('ascii', 0, rinfo.size);
			caller.logger.debug('[Tirex] Message recieved: ' + s);
			var msg = caller.deserialize_tirex_msg(s);
			if (msg.id[0] == 'n') {
				caller.tirex_msg(msg);
			}
		});
		sock.bind('');
		this.sock = sock;
		cb(sock);
	} catch (e) {
		this.logger.error('[Tirex] Could not connect to Tirex Master', e);
	}
};

/**
 * handle with matching metatile request
 */

Tirex.prototype.getImage = function (treq, options) {
	var map = this.maps[treq.mapname];
	var meta_x = treq.x - treq.x % 8;
	var meta_y = treq.y - treq.y % 8;
	var l = this.fingerprint(map.name, meta_x, meta_y, treq.z);
	if (this.requests[l]) {
		//there is a matching pending render request, so attach
		this.logger.debug('[Tirex] tile request queued since a request for this meta already running');
		this.requests[l].push(treq);
		return;
	}
	var caller = this;
	var meta_req = new MetaTileRequest(new MetaTile(meta_x, meta_y, treq.z, metatileoptions));
	meta_req.map = map;
	meta_req.push(treq);
	this.requests[l] = meta_req;
	meta_req.readImage(map.tiledir, function (err) {
		if (err) {
			//could not be loaded from metatile -> request rendering
			caller.q.push({meta_req: meta_req});
		} else {
			delete caller.requests[l];
		}
	});
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
		//clear timeout timer
		meta_req.handled = true;
		if (meta_req.timeout_timer) {
			clearTimeout(meta_req.timeout_timer);
		}
		caller.logger.debug('[Tirex] Tirex req handled');
		//try reading the requested tile from the metatile
		meta_req.readImage(meta_req.map.tiledir, function (err) {
			if (err)
				meta_req.error('Tirex Rendering failed :.(');
		});
	}
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
		x: meta_req.meta.x,
		y: meta_req.meta.y,
		z: meta_req.meta.z
	};
	var caller = this;
	this.logger.debug("[Tirex] message to tirex:", JSON.stringify(msg));
	var s = this.serialize_tirex_msg(msg);
	var buf = new Buffer(s);
	this.connect(function (err, sock) {
		sock.send(buf, 0, buf.length, caller.settings.master_socket, function (err) {
			if (err) {
				caller.logger.error('[Tirex] Error sending to Tirex', err);
			}
		});
	});
	meta_req.timeout_timer = setTimeout(function () {
		if (!meta_req.handled) {
			var l = caller.fingerprint(meta_req.map.name, msg.x, msg.y, msg.z);
			delete caller.requests[l];
			meta_req.error('Tirex Timeout :.(');
		}
	}, this.settings.timeout);
};

exports.Plug = Tirex;