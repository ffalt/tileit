var ImageRequest = require('./utils_request.js').ImageRequest;
var Projections = require('./utils_projections.js').Projections;

function WMS(settings) {
	this.settings = settings;
	this.imagerequest = new ImageRequest(this.settings.concurrent_requests);
}

WMS.prototype.getImage = function (mapname, x, y, z, format, options, cb) {
	var caller = this;
	var bbox = Projections.proj_bbox(x, y, z, options.crs);
	var tile_url = options.tile_url + "&BBOX=" + [bbox.nw[1], bbox.se[0], bbox.se[1], bbox.nw[0] ].join(',');
	this.stats.current_inc(mapname);
	this.imagerequest.request(tile_url, format, function (err, data) {
		caller.stats.current_dec(mapname);
		cb(err, {buffer: data, format: format});
	});
};

WMS.prototype.validateMapOptions = function (mapname, options) {
	var params = [];
	params.push("LAYERS=" + (options.layers || ''));
	params.push("SERVICE=" + (options.service || 'WMS'));
	params.push("VERSION=" + (options.version || "1.1.1"));
	params.push("REQUEST=GetMap");
	params.push("TRANSPARENT=" + (options.transparent ? "true" : "false"));
	params.push("STYLES=" + (options.styles || ''));
	params.push("FORMAT=" + 'image/' + (options.format || 'png'));
	params.push("WIDTH=" + 256);
	params.push("HEIGHT=" + 256);
	if (!Projections.isKnownProjection(options.crs))
		console.error('[WMS] Invalid CRS:', options.crs, 'map:', mapname);
	var v = parseFloat(options.version || "1.1");
	var projectionKey = v >= 1.3 ? 'CRS' : 'SRS';
	params.push(projectionKey + "=" + options.crs);
	options.tile_url = options.url + ((options.url.indexOf('?') < 0) ? "?" : "&") + params.join('&')
};

exports.Plug = WMS;