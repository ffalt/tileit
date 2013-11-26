var ImageRequest = require('./utils_request.js').ImageRequest;

function Tiles(settings) {
	this.settings = settings;
	this.imagerequest = new ImageRequest(this.settings.concurrent_requests);
}

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
