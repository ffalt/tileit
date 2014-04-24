var async = require('async')
	, fs = require('fs')
	, mkdirp = require('mkdirp')
	, path = require('path')
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
	}
//	mapnik.register_default_fonts();
	mapnik.register_system_fonts();
	console.log(mapnik.supports);
	console.log(mapnik.versions);
} catch (e) {
	console.log('mapnik or mapnik config broken ' + e);
}

//mapnik.register_fonts("/path/to/fonts/");
var maps = mappool.create_pool(20);

var vectorFormats = ['pbf', 'json'];
var cairoFormats = ['pdf', 'svg'];

var aquire = function (id, options, callback) {
	var error;
	var methods = {
		create: function (cb) {
			try {
				var map = new mapnik.Map(options.tileSize || 256, options.tileSize || 256);
				if (options.xml) {
					map.load(options.xml, {strict: true}, function (err, map) {
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
				} else if (options.mapdef) {
					mapnikDefs.build(map, mapnik, options.mapdef);
					cb(null, map);
				} else if (typeof options.initMap == 'function') {
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
	maps.acquire(id, methods, function (err, obj) {
		error = error || err;
		callback(error, obj);
	});
};

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
	if (settings.fontpath) {
		console.log('Try loading fonts ', settings.fontpath);
		mapnik.register_fonts(settings.fontpath, { recurse: true });
	}
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
	var caller = this;
	var tile_file = [options.tilesPath, treq.x, treq.y, treq.z].join('/') + '.' + map.format;
	readFile(tile_file, function (ok) {
		if (!ok) {
			mkdirp(path.dirname(tile_file), function (err) {
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
	var caller = this;
	var vtile = new mapnik.VectorTile(treq.z, treq.x, treq.y);
	var opts = {};
	// higher value more coordinates will be skipped
//					opts.tolerance = Math.max(0, Math.min(5, 14 - treq.z));
//					// make larger than zero to enable
//					opts.simplify = 0;
//					// 'radial-distance', 'visvalingam-whyatt', 'zhao-saalfeld' (default)
//					opts.simplify_algorithm = 'radial-distance';
//					opts.buffer_size = map.bufferSize;
	// bbox for x,y,z
	map.extent = proj.mapnik_tile_bbox(treq.x, treq.y, treq.z);
	map.render(vtile, opts, function (err, vtile) {
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
				// TODO https://github.com/mapbox/tilelive-mapnik/issues/56
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
//		Add stats.
//		options.source._stats.total++;
//		if (solid !== false) options.source._stats.solid++;
//		if (solid !== false && image.painted()) options.source._stats.solidPainted++;
		// If solid and image buffer is cached skip image encoding.
//		if (solid && source.solidCache[pixel_key]) return callback(null, source.solidCache[pixel_key]);
		// Note: the second parameter is needed for grid encoding.
//		options.source._stats.encoded++;
		try {
			view.encode(options.format, options, function (err, buffer) {
				if (err) {
					return cb(err);
				}
				if (solid !== false) {
					// @TODO for 'utf' this attaches an extra, bogus 'solid' key to
					// to the grid as it is not a buffer but an actual JS object.
					// Fix is to propagate a third parameter through callbacks all
					// the way back to tilelive source #getGrid.
					buffer.solid = pixel_key;
//					source.solidCache[pixel_key] = buffer;
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
//			cb();
		});
};

Mapnik.prototype.renderMetaImage = function (map, meta_req, options, cb) {
	var caller = this;
	var meta = meta_req.metatile;
	var image = new mapnik.Image(meta.width, meta.height);
	map.resize(meta.width, meta.height);
	map.extent = meta.bbox;
	map.render(image, function (err, image) {
		if (err) {
			global.logger.error('[Mapnik] Render-Error: ' + err, options.xml);
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
						if(err) global.logger.error('[Mapnik] Metatile could not be saved: ' + err + ' '+ options.tilesPath, options.xml);
						cb(); // notify that this is handled here now
						caller.sendMetaImages(map, meta_req);
					})
				}
			});
		}
	});
};

Mapnik.prototype.renderImageTile = function (map, treq, options, cb) {
	var caller = this;
	var im = new mapnik.Image(map.width, map.height);
	// bbox for x,y,z
	map.extent = proj.mapnik_tile_bbox(treq.x, treq.y, treq.z);
	map.render(im, function (err, im) {
		if (err) {
			global.logger.error('[Mapnik] Render-Error: ' + err, options.xml);
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
//			.q.push({meta_req: meta_req});
		} else {
			delete caller.requests[l];
		}
	});
};

Mapnik.prototype.requestRenderMetaImage = function (meta_req, options) {
	var caller = this;
	var stylesheet = options.xml ? path.resolve(options.xml) : options.mapname;
	aquire(stylesheet, options, function (err, map) {
		var cleanup = function () {
			delete caller.requests[meta_req.fingerprint];
			process.nextTick(function () {
				maps.release(stylesheet, map);
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
	var stylesheet = path.resolve(options.xml);
	aquire(stylesheet, options, function (err, map) {

		var cleanup = function () {
			process.nextTick(function () {
				maps.release(stylesheet, map);
			});
		};

		if (err || (!map)) {
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

/*
 Mapnik.prototype.getInfo=function(){
 (mapnik.versions);
 (mapnik.versions.node);
 (mapnik.versions.v8);
 (mapnik.versions.mapnik);
 (mapnik.versions.mapnik_number);
 (mapnik.versions.boost);
 (mapnik.versions.boost_number);
 }
 */

exports.Plug = Mapnik;