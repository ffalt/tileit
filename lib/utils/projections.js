var proj4 = require('proj4');
var SphericalMercator = require('sphericalmercator');

var projmec = proj4('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over');

function Projections() {
	var size = 256;
	this.Bc = [];
	this.Cc = [];
	this.zc = [];
	this.Ac = [];
	this.DEG_TO_RAD = Math.PI / 180;
	this.RAD_TO_DEG = 180 / Math.PI;
	this.size = 256;
	this.levels = 18;
	this.proj4 = proj4;
	for (var d = 0; d < this.levels; d++) {
		this.Bc.push(size / 360);
		this.Cc.push(size / (2 * Math.PI));
		this.zc.push(size / 2);
		this.Ac.push(size);
		size *= 2;
	}


	this.merc = new SphericalMercator({
		size: 256
	});
}

var EPSG4326 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';
var EPSG3857 = '+proj=longlat +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs';
var EPSG = {
	"EPSG:4326": EPSG4326,
	"EPSG:3857": EPSG3857
};


Projections.prototype.isKnownProjection = function (crs) {
	return EPSG[crs];
};

Projections.prototype.pixel_bbox = function (x, y, tilesize) {
	tilesize = tilesize || 256;
	return [
		x * tilesize,
		y * tilesize,
		x * tilesize + tilesize,
		y * tilesize + tilesize
	];
};

Projections.prototype.getMerc = function (tilesize) {
	if ((tilesize) || (tilesize != 256))
	//TODO: cache other tilesizes
		return new SphericalMercator({
			size: tilesize
		});
	else
		return this.merc;
};

Projections.prototype.xy_bbox = function (lng_lat_bbox, zoom, tilesize) {
	var merc = this.getMerc(tilesize);
//	bbox {Number} bbox in the form [w, s, e, n].
	var b = merc.xyz(lng_lat_bbox, zoom, false);
	return [b.minX, b.minY, b.maxX, b.maxY];
};

Projections.prototype.xy_bbox_full = function (zoom) {
	return [ 0, 0,
		Math.pow(2, zoom) - 1,
		Math.pow(2, zoom) - 1
	];
};

Projections.prototype.lng_lat_bbox = function (x, y, z, tilesize) {
	var merc = this.getMerc(tilesize);
	//Convert tile xyz value to bbox of the form [w, s, e, n]
	return merc.bbox(x, y, z, false)
};

Projections.prototype.mapnik_bbox = function (x, y, z, tilesize) {
	var merc = this.getMerc(tilesize);
	return merc.bbox(x, y, z, false);
};

Projections.prototype.proj_bbox = function (x, y, z, crs) {
	var proj_crs = EPSG[crs];
	var ll_bbox = this.latlng_bbox(x, y, z);
	var bounds = {
		nw: proj4(EPSG3857, proj_crs, [ll_bbox.nw.lat, ll_bbox.nw.lng]),
		se: proj4(EPSG3857, proj_crs, [ll_bbox.se.lat, ll_bbox.se.lng])
	};
	return bounds;
};

exports.Projections = new Projections();