var proj4 = require('proj4');

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

Projections.prototype.pointToLatLng_EPSG3857 = function (p, zoom) {
	var p = this.px_to_ll(p, zoom);
	return {lat: p[0], lng: p[1]};
};

Projections.prototype.pixel_bbox = function (x, y) {
	var bounds = {
		nw: [x * this.size, y * this.size]
	};
	bounds.se = [bounds.nw[0] + this.size, bounds.nw[1] + this.size];
	return bounds;
};

Projections.prototype.latlng_bbox = function (x, y, z) {
	var px_bbox = this.pixel_bbox(x, y);
	var bounds = {
		nw: this.pointToLatLng_EPSG3857(px_bbox.nw, z),
		se: this.pointToLatLng_EPSG3857(px_bbox.se, z)
	};
	return bounds;
};

Projections.prototype.px_to_ll = function (px, zoom) {
	var zoom_denom = this.zc[zoom];
	var g = (px[1] - zoom_denom) / (-this.Cc[zoom]);
	var lat = (px[0] - zoom_denom) / this.Bc[zoom];
	var lon = this.RAD_TO_DEG * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
	return [lat, lon];
};

Projections.prototype.mapnik_bbox = function (x, y, z) {
	var px_bbox = this.pixel_bbox(x, y);
	var bounds = {
		nw: this.px_to_ll(px_bbox.nw, z),
		se: this.px_to_ll(px_bbox.se, z)
	};
	bounds = {
		nw: projmec.forward([bounds.nw[0], bounds.nw[1]]),
		se: projmec.forward([bounds.se[0], bounds.se[1]])
	};
	return [
		Math.min(bounds.nw[0], bounds.se[0]),
		Math.min(bounds.nw[1], bounds.se[1]),
		Math.max(bounds.nw[0], bounds.se[0]),
		Math.max(bounds.nw[1], bounds.se[1])
	];
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