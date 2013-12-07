var async = require('async')
	, fs = require('fs')
	, mkdirp = require('mkdirp')
	, path = require('path')
	, mappool = require('./utils/pool.js')
	, proj = require('./utils/projections.js').Projections
	, MetaTile = require('./utils/metatile.js').MetaTile
	, MetaTileRequest = require("./utils/metatile_request.js").MetaTileRequest;

try {
	var mapnik = require('mapnik');
	mapnik.register_default_fonts();
	console.log(mapnik.supports);
	console.log(mapnik.versions);
} catch (e) {
	console.log('mapnik or mapnik config broken ' + e);
}
//mapnik.register_fonts("/path/to/fonts/");
var maps = mappool.create_pool(5);

var vectorFormats = ['pbf', 'json', 'svg'];
var cairoFormats = ['pdf', 'svg'];
//map.render_to_file('map.pdf')

var aquire = function (id, options, callback) {
	methods = {
		create: function (cb) {
			var map = new mapnik.Map(options.tileSize || 256, options.tileSize || 256);
			if (options.xml) {
				map.load(options.xml, {strict: true}, function (err, map) {
					if (options.bufferSize) {
						map.bufferSize = options.bufferSize;
					}
					cb(err, map);
				});
			} else if (typeof options.initMap == 'function') {
				options.initMap(map, mapnik, function (err) {
					cb(err, map);
				});
			} else {
				cb("[Mapnik] Invalid map definition " + options.mapname, map);
			}
		},
		destroy: function (obj) {
			delete obj;
		}
	};
	maps.acquire(id, methods, function (err, obj) {
		callback(err, obj);
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
 *
 * @param settings from config.js
 * @constructor
 */

//ImageIO Formats: https://github.com/mapnik/mapnik/wiki/Image-IO

function Mapnik(name, settings, logger) {
	this.name = name;
	this.settings = settings;
	this.logger = logger;
	this.requests = {};
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
	var tile_file = options.tilepath + [treq.x, treq.y, treq.z].join('/') + '.svg';
	treq.format = 'svg+xml';
	readFile(tile_file, function (ok) {
		if (!ok) {
			mkdirp(path.dirname(tile_file), function (err) {
				if (err) {
					caller.logger.error("[Mapnik] Could not create directory", path.dirname(tile_file), err);
					return cb(err);
				}
				map.renderFileSync(tile_file, {
					format: options.format,
					scale: options.scale || 1,
					scale_denominator: options.scale_denominator || 0.0
				});
				readFile(tile_file, function (done) {
					if (!done)
						treq.finish('[Mapnik] Svg not rendered');
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
	map.render(vtile, opts, function (err, vtile) {
		cb();
		if (err) {
			caller.logger.error('[Mapnik] VectorTile-Render-Error: ' + err, options.xml);
			treq.finish(err);
		} else {
			var data;
			if (options.format == 'json') {
				treq.format = 'x-json';
				treq.format_type = 'text';
				data = JSON.stringify(vtile.toGeoJSON(0));
			} else {
				treq.format = 'x-protobuf';
				treq.format_type = 'application';
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

Mapnik.prototype.storeMetaTile = function (map, image, meta, options) {
	var caller = this;
	async.forEachSeries(meta.getTiles(), function (tile, nextcb) {
		if (tile.buffer) {
			nextcb();
		} else {
			caller.renderMetaImageTile(tile, image, meta, options, function (err, buffer) {
				tile.buffer = buffer;
				nextcb();
			});
		}
	}, function () {
		meta.saveFile(path.resolve(options.tilespath), function (tile) {
			return tile.buffer;
		}, function (err) {
			//cb();
		})
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
			caller.logger.error('[Mapnik] Render-Error: ' + err, options.xml);
			meta_req.error(err);
			cb(err);
		} else {
			cb(); // notify that this is handled here now (possible double rendering of the same metatile may occure)
			async.forEachSeries(meta_req.requests,
				function (tile, nextcb) {
					caller.renderMetaImageTile(tile, image, meta, options, function (err, buffer) {
						tile.buffer = buffer;
						meta_req.sendImage(tile, buffer, err, nextcb);
					});
				}
				, function () {
					if (options.tilespath)
						caller.storeMetaTile(map, image, meta, options);

				});
		}
	});
};

Mapnik.prototype.renderImageTile = function (map, treq, options, cb) {
	var caller = this;
	var im = new mapnik.Image(map.width, map.height);
	map.render(im, function (err, im) {
		if (err) {
			caller.logger.error('[Mapnik] Render-Error: ' + err, options.xml);
			treq.finish(err);
		} else {
			im.encode(options.format, function (err, buffer) {
				if (err) {
					caller.logger.error('[Mapnik] Encode-Error: ' + err, options.xml);
					treq.finish(err);
					return;
				}
				treq.finish(null, buffer);
			});
		}
		cb();
	});
};

Mapnik.prototype.fingerprint = function (mapname, x, y, z) {
	return [mapname, z, x, y].join('/');
};

Mapnik.prototype.getImage = function (treq, options) {
	options.format = options.format || "png";
	if (vectorFormats.indexOf(options.format) >= 0) {
		this.requestSingleImage(treq, options);
	} else if (options.metatile > 0) {
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
		this.logger.debug('[Mapnik] tile request queued since a request for this meta already running');
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
	meta_req.readImage(options.tilespath, function (err) {
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
		if (err) {
			caller.logger.error('[Mapnik] XML-Error: ' + err, options.xml);
			meta_req.error(err);
			cleanup();
		} else {
			// bbox for x,y,z
//			map.extent = proj.mapnik_bbox(treq.x, treq.y, treq.z);
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

		if (err) {
			caller.logger.error('[Mapnik] XML-Error: ' + err, options.xml);
			treq.finish(err);
			cleanup();
		} else {
			// bbox for x,y,z
			map.extent = proj.mapnik_bbox(treq.x, treq.y, treq.z);
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