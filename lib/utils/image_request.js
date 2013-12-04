var request = require('request');
var async = require('async');

function ImageRequest(concurrent_requests, logger) {
	this.logger = logger;
	this.queue = async.queue(function (task, callback) {
		logger.debug('[ImageRequest] Requesting:', task.url);
		request({url: task.url, encoding: null}, function (error, response, body) {
			if (!error) {
				if (response.statusCode !== 200)
					error = 'StatusCode: ' + response.statusCode;
				else if (!(response.headers["content-type"].match(/^image\//)))
					error = 'Invalid Type: ' + response.headers["content-type"];
				else {
					//quick & dirty file header check
					var fileheader = body.toString('ascii', 1, 5).toLowerCase();
					if (task.format == fileheader)
						error = 'Invalid File Header ' + fileheader;
				}
			}
			if (error) {
				logger.error("[ImageRequest] Could not fetch tile from server", task.url, error);
				task.cb(error);
			} else {
				task.cb(null, body);
			}
			callback(); //next task
		});
	}, concurrent_requests);
}

ImageRequest.prototype.request = function (url, format, cb) {
	var caller = this;
	this.queue.push({url: url, format: format, cb: cb}, function (err) {
		if (err) {
			caller.logger.error("[ImageRequest] Error fetching tile:", url, err);
		}
	});
};

exports.ImageRequest = ImageRequest;