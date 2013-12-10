var FileRequest = require('./utils/file_request.js').FileRequest;
var Projections = require('./utils/projections.js').Projections;

/**
 * The WMS Plug for translate slippy request for tiles from a wms server
 * http://en.wikipedia.org/wiki/Web_Map_Service
 *
 * @param settings from config.js
 * @constructor
 */

function WMS(name, settings, logger) {
	this.name = name;
	this.settings = settings;
	this.logger = logger;
	this.filerequest = new FileRequest(this.settings.concurrent_requests, logger);
}

/**
 * compile an wms map url with the bounding box and request the image
 */

WMS.prototype.getImage = function (treq, options, cb) {
	var bbox = Projections.proj_bbox(treq.x, treq.y, treq.z, options.crs);
	var tile_url = options.tile_url + "&BBOX=" + [bbox.nw[1], bbox.se[0], bbox.se[1], bbox.nw[0] ].join(',');
	this.filerequest.request(tile_url, treq.format, function (err, buffer) {
		treq.finish(err, buffer);
	});
};

/**
 * compiles a wms map url and store it into the options
 */

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
		this.logger.error('[WMS] Invalid CRS:', options.crs, 'map:', mapname);
	var v = parseFloat(options.version || "1.1");
	var projectionKey = v >= 1.3 ? 'CRS' : 'SRS';
	params.push(projectionKey + "=" + options.crs);
	options.tile_url = options.url + ((options.url.indexOf('?') < 0) ? "?" : "&") + params.join('&')
};

exports.Plug = WMS;