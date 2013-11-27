var ImageRequest = require('./utils_request.js').ImageRequest;

/**
 * The Tiles Plug for requesting tiles from another slippy maps server
 *
 * @param settings from config.js
 * @constructor
 */

function Tiles(name, settings, logger) {
	this.name = name;
	this.settings = settings;
	this.logger = logger;
	this.imagerequest = new ImageRequest(this.settings.concurrent_requests, logger);
}

/**
 * Compiles an slippy map url and requests an image
 */

Tiles.prototype.getImage = function (treq, options) {
	var caller = this;
	var tile_url = [options.url, treq.z, treq.x, treq.y + '.' + treq.format].join('/');
	this.imagerequest.request(tile_url, treq.format, function (err, buffer) {
		treq.finish(err, buffer);
	});
};

exports.Plug = Tiles;
