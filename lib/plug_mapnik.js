var path = require('path');
var mapnik = require('mapnik')
	, mappool = require('./utils/pool.js')
	, proj = require('./utils/projections.js').Projections;

mapnik.register_default_fonts();
var maps = mappool.create_pool(5);

var aquire = function (id, options, callback) {
	methods = {
		create: function (cb) {
			var obj = new mapnik.Map(options.width || 256, options.height || 256);
			obj.load(id, {strict: true}, function (err, obj) {
				if (options.bufferSize) {
					obj.bufferSize = options.bufferSize;
				}
				cb(err, obj);
			});
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

	Mapnik.prototype.getImage = function (treq, options) {
		var caller = this;
		var stylesheet = path.resolve(options.xml);
		var format = options.format || "png";
		aquire(stylesheet, options, function (err, map) {
			if (err) {
				process.nextTick(function () {
					maps.release(stylesheet, map);
				});
				caller.logger.error('[Mapnik] XML-Error: ' + err, options.xml);
				treq.finish(err);
			} else {
				// bbox for x,y,z
				map.extent = proj.mapnik_bbox(treq.x, treq.y, treq.z);
				if (['pbf', 'json'].indexOf(format) >= 0) {
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
						process.nextTick(function () {
							maps.release(stylesheet, map);
						});
						if (err) {
							caller.logger.error('[Mapnik] VectorTile-Render-Error: ' + err, options.xml);
							treq.finish(err);
						} else {
							var data;
							if (format == 'json') {
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
				} else {
					var im = new mapnik.Image(map.width, map.height);
					map.render(im, function (err, im) {
						process.nextTick(function () {
							maps.release(stylesheet, map);
						});
						if (err) {
							caller.logger.error('[Mapnik] Render-Error: ' + err, options.xml);
							treq.finish(err);
						} else {
							im.encode(format, function (err, buffer) {
								if (err) {
									caller.logger.error('[Mapnik] Encode-Error: ' + err, options.xml);
									treq.finish(err);
									return;
								}
								treq.finish(null, buffer);
							});
						}
					});
				}
			}
		});
	};
}

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