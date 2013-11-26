var ImageRequest = require('./utils_request.js').ImageRequest;

/**
 * The Tiles Plug for requesting tiles from another slippy maps server
 *
 * @param settings from config.js
 * @constructor
 */

function Tiles(settings) {
	this.settings = settings;
	this.imagerequest = new ImageRequest(this.settings.concurrent_requests);
}

/**
 * Compiles an slippy map url and requests an image
 */

Tiles.prototype.getImage = function (mapname, x, y, z, format, options, cb) {
	var caller = this;
	var tile_url = [options.url, z, x, y + '.' + format].join('/');
	this.stats.current_inc(mapname);
	this.imagerequest.request(tile_url, format, function (err, data) {
		caller.stats.current_dec(mapname);
		cb(err, {buffer: data, format: format});
	});
};

exports.Plug = Tiles;
