var request = require('request');
var async = require('async');

function FileRequest(concurrent_requests) {
	this.queue = async.queue(function (task, callback) {
		global.logger.debug('[FileRequest] Requesting:', task.url);
		request({url: task.url, encoding: null}, function (error, response, body) {
			if (!error) {
				if (response.statusCode !== 200)
					error = 'StatusCode: ' + response.statusCode;
				else if ((task.test_content_type) && (response.headers["content-type"].toLowerCase().indexOf(task.test_content_type) < 0))
					error = 'Invalid Type: ' + response.headers["content-type"];
				else if (task.test && (!task.test(body))) {
					error = 'Invalid File Header';
				}
			}
			if (error) {
				global.logger.error("[FileRequest] Could not fetch tile from server", task.url, error);
				task.cb(error);
			} else {
				task.cb(null, body);
			}
			callback(); //next task
		});
	}, concurrent_requests);
}

FileRequest.prototype.request = function (url, format, cb) {
	var caller = this,
		test_content_type = null,
		test = null;
	//quick & dirty file header checks
	if (format == 'png') {
		test_content_type = 'image/png';
		test = function (data) {
			var fileheader = data.toString('ascii', 1, 4);
			return  (fileheader == 'PNG');
		};
	} else if (format == 'jpeg') {
		test_content_type = 'image/jpeg';
		test = function (data) {
			var fileheader = data.toString('ascii', 6, 10);
			return (fileheader == 'JFIF');
		};
	} else if (format == 'svg') {
//		test_content_type = 'image/svg+xml';
		test_content_type = 'image/svg';
		test = function (data) {
			var fileheader = data.toString('ascii', 2, 5);
			return (fileheader == 'xml');
		};
//	} else if (format == 'utf') {
//		test_content_type = 'image';
//		test = function (data) {
//			var fileheader = data.toString('ascii', 0, 10);
//			console.log(fileheader);
//			return false;//(fileheader == 'xml');
//		}
	}
	this.queue.push({url: url, test_content_type: test_content_type, test: test, cb: cb}, function (err) {
		if (err) {
			global.logger.error("[FileRequest] Error fetching tile:", url, err);
		}
	});
};

exports.FileRequest = FileRequest;