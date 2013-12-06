var async = require('async');

/**
 * bundles requests for tiles from a meta-tile
 **/

function MetaRequest(metatile) {
	this.metatile = metatile;
	this.requests = [];
	this.handled = false;
}

/**
 * bundle request for a tile in the request-hash
 **/

MetaRequest.prototype.push = function (treq) {
	var tile = this.metatile.getTile(treq.x, treq.y);
	tile.requests = tile.requests || [];
	tile.requests.push(treq);
	if (this.requests.indexOf(tile) < 0)
		this.requests.push(tile);
};

/**
 * send error on all requests for tiles on this metatile
 **/

MetaRequest.prototype.error = function (message) {
	this.handled = true;
	async.forEachSeries(this.requests, function (tile, nextcb) {
		tile.requests.forEach(function (req) {
			req.finish(message);
		});
		nextcb();
	}, function () {
	});
};

/**
 * try reading a meta-tile
 **/

MetaRequest.prototype.sendImage = function (tile, buffer, err, cb) {
	async.forEachSeries(tile.requests, function (req, regnext) {
		req.finish(err, buffer);
		regnext();
	}, function () {
		cb();
	});
};

MetaRequest.prototype.readImage = function (rootdir, cb) {
	var caller = this;
	this.metatile.openFile(rootdir, function (err, file) {
		if (!err) {

			var handleTileRequest = function (tile, nextcb) {
				caller.metatile.readFileTile(tile, file, function (err, buffer) {
					caller.sendImage(tile, buffer, err, nextcb);
				});
			};

			//todo: test if this could be done parallel (most probably)
			caller.handled = true;
			async.forEachSeries(caller.requests, handleTileRequest, function () {
				caller.metatile.closeFile(file);
			});
		}

		cb(err);
	});
};

exports.MetaTileRequest = MetaRequest;
