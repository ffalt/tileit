var async = require("async");
var Projections = require('./projections.js').Projections;

function TilesCollector() {
	var me = this;
	this.collectmapzoom = function (map, zoom, bbox, cb) {
		var result = [];
		var xybox = [];
		if (!bbox) {
			xybox = Projections.xy_bbox_full(zoom);
		} else {
			// bbox` {Number} bbox in the form `[w, s, e, n]`.
			xybox = Projections.xy_bbox(bbox, zoom, 256);
			if (xybox[0] > xybox[2]) {
				var c = xybox[0];
				xybox[0] = xybox[2];
				xybox[2] = c;
			}
			if (xybox[1] > xybox[3]) {
				var c = xybox[1];
				xybox[1] = xybox[3];
				xybox[3] = c;
			}
			// lng_lat_bbox, zoom, tilesize
		}
		for (var x = xybox[0]; x <= xybox[2]; x++) {
			for (var y = xybox[1]; y <= xybox[3]; y++) {
				var req = {
					'map': map,
					'x': x,
					'y': y,
					'z': zoom
				};
				result.push(req);
			}
		}
		cb(result);
	};

	this.collectmapzooms = function (map, zooms, bbox, cb) {
		var result = [];
		async.forEachSeries(zooms, function (zoom, nextcb) {
			me.collectmapzoom(map, zoom, bbox, function (reqs) {
				result = result.concat(reqs);
				nextcb();
			});
		}, function () {
			cb(result);
		});
	};

	this.collect = function (maps, zooms, bbox, cb) {
		var result = [];
		async.forEachSeries(maps, function (map, nextcb) {
				me.collectmapzooms(map, zooms, bbox, function (reqs) {
					result = result.concat(reqs);
					nextcb();
				});
			},
			function () {
				cb(result);
			}
		);
	};
}

exports.TilesCollector = TilesCollector;