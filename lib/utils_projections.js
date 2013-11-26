var proj4 = require('proj4');

function Projections() {

}

var EPSG4326 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';
var EPSG3857 = '+proj=longlat +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs';
var EPSG = {
	"EPSG:4326": EPSG4326,
	"EPSG:3857": EPSG3857
};

Projections.consts = {
	_a: 0.5 / Math.PI,
	_b: 0.5,
	_c: -0.5 / Math.PI,
	_d: 0.5,
	RAD_TO_DEG: 180 / Math.PI,
	tilesize: 256
};

Projections.isKnownProjection = function (crs) {
	return EPSG[crs];
};

Projections.pointToLatLng_EPSG3857 = function (p, zoom) {
	var scale = 256 * Math.pow(2, zoom);
	p[0] = (p[0] / scale - this.consts._b) / this.consts._a;
	p[1] = (p[1] / scale - this.consts._d) / this.consts._c;
	var lng = p[0] * this.consts.RAD_TO_DEG;
	var lat = (2 * Math.atan(Math.exp(p[1])) - (Math.PI / 2)) * this.consts.RAD_TO_DEG;
	return {lat: lat, lng: lng};
};

Projections.pixel_bbox = function (x, y) {
	var bounds = {
		nw: [x * this.consts.tilesize, y * this.consts.tilesize]
	};
	bounds.se = [bounds.nw[0] + this.consts.tilesize, bounds.nw[1] + this.consts.tilesize];
	return bounds;
};

Projections.latlng_bbox = function (x, y, z) {
	var px_bbox = this.pixel_bbox(x, y);
	var bounds = {
		nw: this.pointToLatLng_EPSG3857(px_bbox.nw, z),
		se: this.pointToLatLng_EPSG3857(px_bbox.se, z)
	};
	return bounds;
};

Projections.proj_bbox = function (x, y, z, crs) {
	var proj_crs = EPSG[crs];
	var ll_bbox = this.latlng_bbox(x, y, z);
	var bounds = {
		nw: proj4(EPSG3857, proj_crs, [ll_bbox.nw.lat, ll_bbox.nw.lng]),
		se: proj4(EPSG3857, proj_crs, [ll_bbox.se.lat, ll_bbox.se.lng])
	};
	return bounds;
};

exports.Projections = Projections;