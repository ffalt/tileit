var async = require('async')
	, fs = require('fs')
	, fse = require('fs-extra')
	, path = require('path')
	, debug = require('debug')('tileit:mapnik')
	, mapnikDefs = require('./utils/mapnikdef.js').MapnikDefs
	, mappool = require('./utils/pool.js')
	, proj = require('./utils/projections.js').Projections
	, MetaTile = require('./utils/metatile.js').MetaTile
	, MetaTileRequest = require("./utils/metatile_request.js").MetaTileRequest;

try {
	var mapnik = require('mapnik');
	if (!mapnik) {
		console.log('This will not work. Please install mapnik for node (npm install mapnik)');
		return;
	} else {
		if (mapnik.register_default_fonts)
			mapnik.register_default_fonts();
		if (mapnik.register_system_fonts)
			mapnik.register_system_fonts();
		if (mapnik.register_default_input_plugins)
			mapnik.register_default_input_plugins();
	}
	//console.log(mapnik.supports);
	//console.log(mapnik.versions);
} catch (e) {
	console.log('mapnik or mapnik config broken ' + e);
}

var pool = {
	maps: null,
	size: 20,
	idleTimeoutMillis: 5 * 60 * 1000,
	initPool: function () {
		pool.maps = mappool.create_pool(pool.size);
	}
	,
	aquire: function (id, options, callback) {
		var error;
		var pooloptions = {
			idleTimeoutMillis: pool.idleTimeoutMillis,
			create: function (cb) {
				try {
					var map = new mapnik.Map(options.tileSize || 256, options.tileSize || 256);
					if (options.xml) {
						fs.readFile(options.xml, function (err, data) {
							if (err) {
								global.logger.error('[Mapnik] XML-File-Error: ' + err, options.xml);
								return cb(err);
							}
							map.fromString(data.toString(), {strict: true, base: path.dirname(options.xml)}, function (err, map) {
								error = err;
								if (!err) {
									if (options.bufferSize) {
										map.bufferSize = options.bufferSize;
									}
								} else {
									global.logger.error('[Mapnik] XML-Error: ' + err, options.xml);
								}
								cb(err, map);
							});
						});
					} else if (options.mapdef) {
						mapnikDefs.build(map, mapnik, options.mapdef);
						cb(null, map);
					} else if (typeof options.initMap == 'function') {
						mapnik.mapnikDefs = mapnikDefs;
						options.initMap(map, mapnik, options, function (err) {
							error = err;
							cb(err, map);
						});
					} else {
						error = new Error("[Mapnik] Invalid map definition " + options.mapname);
						cb(error);
					}
				} catch (e) {
					error = e;
					cb(e);
				}
			},
			destroy: function (obj) {
				delete obj;
			}
		};
		pool.maps.acquire(id, pooloptions, function (err, obj) {
			error = error || err;
			callback(error, obj);
		});
	}
};
pool.initPool();

var vectorFormats = ['pbf', 'json'];
var cairoFormats = ['pdf', 'svg'];

function empty_img(cb) {
	var im = new mapnik.Image(256, 256);
	im.background = new mapnik.Color('steelblue');
	im.encode('png8:z=1', function (err, buffer) {
		cb(err, buffer);
	});
}

/**
 * The Mapnik Plug for rendering tiles with mapnik
 * http://wiki.openstreetmap.org/wiki/Mapnik
 *
 * @param settings from config.js
 * @constructor
 */

//ImageIO Formats: https://github.com/mapnik/mapnik/wiki/Image-IO

function Mapnik(name, settings) {
	this.name = name;
	this.settings = settings;
	this.requests = {};
	if ((settings.fontpath) && (mapnik)) {
		var p = path.resolve(settings.fontpath);
		//console.log('Try loading fonts ', p);
		mapnik.register_fonts(p, {recurse: true});
	}
	if (settings.pool) {
		if (settings.pool.size)
			pool.size = settings.pool.size;
		if (settings.pool.idleTimeoutMillis)
			pool.idleTimeoutMillis = settings.pool.idleTimeoutMillis;
	}
	pool.initPool();
}

Mapnik.prototype.renderCairoTile = function (map, treq, options, cb) {
	var readFile = function (tile_file, cb) {
		fs.exists(tile_file, function (e) {
			if (e) {
				fs.readFile(tile_file, function (err, buffer) {
					treq.finish(err, buffer);
					cb(true);
				});
			} else {
				cb(false);
			}
		});
	};
	var tile_file = [options.tilesPath, treq.x, treq.y, treq.z].join('/') + '.' + map.format;
	readFile(tile_file, function (ok) {
		if (!ok) {
			fse.ensureDir(path.dirname(tile_file), function (err) {
				if (err) {
					global.logger.error("[Mapnik] Could not create directory", path.dirname(tile_file), err);
					return cb(err);
				}
				// bbox for x,y,z
				map.extent = proj.mapnik_tile_bbox(treq.x, treq.y, treq.z);
				map.renderFileSync(tile_file, {
					format: options.format,
					scale: options.cairoScale || 1,
					scale_denominator: options.cairoScaleDenominator || 0.0
				});
				readFile(tile_file, function (done) {
					if (!done)
						treq.finish('[Mapnik] not rendered (Cairo)');
				});
			});
		}
	});
	cb();
};

Mapnik.prototype.renderVectorTile = function (map, treq, options, cb) {
	var vtile = new mapnik.VectorTile(treq.z, treq.x, treq.y);
	var opts = {};
	/*
	 // higher value more coordinates will be skipped
	 opts.tolerance = Math.max(0, Math.min(5, 14 - treq.z));
	 // make larger than zero to enable
	 opts.simplify = 0;
	 // 'radial-distance', 'visvalingam-whyatt', 'zhao-saalfeld' (default)
	 opts.simplify_algorithm = 'radial-distance';
	 opts.buffer_size = map.bufferSize;
	 */
	// bbox for x,y,z
	map.extent = proj.mapnik_tile_bbox(treq.x, treq.y, treq.z);
	var start = new Date();
	map.render(vtile, opts, function (err, vtile) {
		global.logger.logrender(map, treq, start, new Date());
		cb();
		if (err) {
			global.logger.error('[Mapnik] VectorTile-Render-Error: ' + err, options.xml);
			treq.finish(err);
		} else {
			var data;
			if (options.format == 'json') {
				data = JSON.stringify(vtile.toGeoJSON(0));
			} else {
				data = vtile.getData();
			}
			treq.finish(null, data);
		}
	});
};

Mapnik.prototype.renderMetaImageTile = function (tile, image, meta, options, cb) {
	var view = image.view(
		(tile.x - meta.x) * options.tileSize,
		(tile.y - meta.y) * options.tileSize,
		options.tileSize, options.tileSize);
	view.isSolid(function (err, solid, pixel) {
		if (err) return cb(err);
		var pixel_key = '';
		if (solid) {
			if (options.format === 'utf') {
				pixel_key = pixel.toString();
			} else {
				// https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
				var a = (pixel >>> 24) & 0xff;
				var r = pixel & 0xff;
				var g = (pixel >>> 8) & 0xff;
				var b = (pixel >>> 16) & 0xff;
				pixel_key = options.format + r + ',' + g + ',' + b + ',' + a;
			}
		}
		try {
			view.encode(options.format, options, function (err, buffer) {
				if (err) {
					return cb(err);
				}
				if (solid !== false) {
					buffer.solid = pixel_key;
				}
				return cb(null, buffer);
			});
		} catch (err) {
			cb(err);
		}
	});
};

Mapnik.prototype.sendMetaImages = function (map, meta_req) {
	async.forEachSeries(meta_req.requests,
		function (tile, nextcb) {
			meta_req.sendImage(tile, tile.buffer, null, nextcb);
		}
		, function () {
			// nop
		});
};

Mapnik.prototype.renderMetaImage = function (map, meta_req, options, cb) {
	var caller = this;
	var meta = meta_req.metatile;
	var image = new mapnik.Image(meta.width, meta.height);
	map.resize(meta.width, meta.height);
	map.extent = meta.bbox;
	var start = new Date();
	var opts = {scale: options.scale || 1};
	map.render(image, opts, function (err, image) {
		global.logger.logrender(map, meta_req, start, new Date());
		if (err) {
			global.logger.error('[Mapnik] Render-Error Meta-Tile: ' + err, options.xml);
			meta_req.error(err);
			cb(err);
		} else {
			async.forEachSeries(meta.getTiles(), function (tile, nextcb) {
				caller.renderMetaImageTile(tile, image, meta, options, function (err, buffer) {
					tile.buffer = buffer;
					nextcb();
				});
			}, function () {
				if (!options.tilesPath) {
					cb(); // notify that this is handled here now
					caller.sendMetaImages(map, meta_req);
				} else {
					meta.saveFile(path.resolve(options.tilesPath), function (tile) {
						return tile.buffer;
					}, function (err) {
						if (err) global.logger.error('[Mapnik] Metatile could not be saved: ' + err + ' ' + options.tilesPath, options.xml);
						cb(); // notify that this is handled here now
						caller.sendMetaImages(map, meta_req);
					})
				}
			});
		}
	});
};

Mapnik.prototype.renderImageTile = function (map, treq, options, cb) {
	var im = new mapnik.Image(map.width, map.height);
	// bbox for x,y,z
	map.extent = proj.mapnik_tile_bbox(treq.x, treq.y, treq.z);
	var start = new Date();
	var opts = {scale: options.scale || 1};
	map.render(im, opts, function (err, im) {
		global.logger.logrender(map, treq, start, new Date());
		if (err) {
			global.logger.error('[Mapnik] Render-Error Single Tile: ' + err, options.xml);
			treq.finish(err);
		} else {
			im.encode(options.format, function (err, buffer) {
				if (err) {
					global.logger.error('[Mapnik] Encode-Error: ' + err, options.xml);
					treq.finish(err);
				} else {
					treq.finish(null, buffer);
				}
			});
		}
		cb();
	});
};

Mapnik.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

Mapnik.prototype.getStoragePath = function (mapname, options) {
	return options.tilesPath;
};

Mapnik.prototype.getImage = function (treq, options) {
	if (!mapnik)
		return treq.finish('[Mapnik] package mapnik not loaded');
	options.format = options.format || "png";
	if ((vectorFormats.indexOf(options.format) >= 0) || (cairoFormats.indexOf(options.format) >= 0)) {
		this.requestSingleImage(treq, options);
	} else if (options.metaTileCount && (options.metaTileCount > 0)) {
		this.requestMetaImage(treq, options);
	} else {
		this.requestSingleImage(treq, options);
	}
};

Mapnik.prototype.requestMetaImage = function (treq, options) {
	var meta_x = treq.x - treq.x % 8;
	var meta_y = treq.y - treq.y % 8;
	var l = this.fingerprint(treq.mapname, meta_x, meta_y, treq.z);
	if (this.requests[l]) {
		//there is a matching pending render request, so attach
		global.logger.debug('[Mapnik] tile request queued since a request for this meta already running');
		this.requests[l].push(treq);
		return;
	}
	var caller = this;
	var meta = new MetaTile(meta_x, meta_y, treq.z, options);
	var meta_req = new MetaTileRequest(meta);
	meta_req.mapname = treq.mapname;
	meta_req.fingerprint = l;
	meta_req.push(treq);
	this.requests[l] = meta_req;
	meta_req.readImage(options.tilesPath, function (err) {
		if (err) {
			//could not be loaded from metatile -> request rendering
			caller.requestRenderMetaImage(meta_req, options);
		} else {
			delete caller.requests[l];
		}
	});
};

Mapnik.prototype.requestRenderMetaImage = function (meta_req, options) {
	var caller = this;
	var stylesheet = meta_req.mapname;
	pool.aquire(stylesheet, options, function (err, map) {
		var cleanup = function () {
			delete caller.requests[meta_req.fingerprint];
			process.nextTick(function () {
				pool.maps.release(stylesheet, map);
			});
		};
		if (err || (!map)) {
			global.logger.error('[Mapnik] ' + err, options.xml);
			meta_req.error(err);
			cleanup();
		} else {
			caller.renderMetaImage(map, meta_req, options, cleanup);
		}
	});
};

Mapnik.prototype.requestSingleImage = function (treq, options) {
	var caller = this;
	var stylesheet = treq.mapname;
	pool.aquire(stylesheet, options, function (err, map) {
		var cleanup = function (e) {
			process.nextTick(function () {
				pool.maps.release(stylesheet, map);
			});
		};
		if (err || (!map)) {
			global.logger.error('[Mapnik] Load Error: ' + err, treq.mapname);
			treq.finish(err);
			cleanup();
		} else {
			if (cairoFormats.indexOf(options.format) >= 0) {
				caller.renderCairoTile(map, treq, options, cleanup);
			} else if (vectorFormats.indexOf(options.format) >= 0) {
				caller.renderVectorTile(map, treq, options, cleanup);
			} else {
				caller.renderImageTile(map, treq, options, cleanup);
			}
		}
	});
};

Mapnik.prototype.clearCache = function (mapname) {
	//TODO: clear cache only for mapname
	pool.initPool();
};

exports.Plug = Mapnik;