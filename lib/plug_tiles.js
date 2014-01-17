var FileRequest = require('./utils/file_request.js').FileRequest;

/**
 * The Tiles Plug for requesting tiles from another slippy maps server
 *
 * @param settings from config.js
 * @constructor
 */

function Tiles(name, settings) {
	this.name = name;
	this.settings = settings;
	this.filerequest = new FileRequest(this.settings.concurrent_requests);
}

/**
 * Compiles an slippy map url and requests an image
 */

Tiles.prototype.getImage = function (treq, options) {
	var tile_url = options.url.replace(/\{x\}/g, treq.x).replace(/\{y\}/g, treq.y).replace(/\{z\}/g, treq.z);
	this.filerequest.request(tile_url, treq.format, function (err, buffer) {
		treq.finish(err, buffer);
	});
};

exports.Plug = Tiles;
