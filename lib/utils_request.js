var request = require('request');
var async = require('async');

function ImageRequest(concurrent_requests) {
	this.queue = async.queue(function (task, callback) {
		console.debug('[ImageRequest] Requesting:', task.url);
		request({url: task.url, encoding: null}, function (error, response, body) {
			if (error || response.statusCode !== 200 || !(response.headers["content-type"].match(/^image\//))) {
				console.error("[ImageRequest] Could not fetch tile from server", task.url);
				//TODO check for file header format
				task.cb(error || response.statusCode);
			} else {
				task.cb(null, body);
			}
			callback(); //next task
		});
	}, concurrent_requests);
}

ImageRequest.prototype.request = function (url, format, cb) {
	this.queue.push({url: url, format: format, cb: cb}, function (err) {
		if (err) {
			console.error("[ImageRequest] Error fetching tile:", url, err);
		}
	});
};

exports.ImageRequest = ImageRequest;