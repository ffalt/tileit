var fs = require('fs');
var images = require("images");
var async = require("async");

if (!images) {
	console.log('This will not work. Please install images for node (npm install images)');
	return;
}

function CompositePlug(name, settings) {
	this.name = name;
	this.settings = settings;
}

CompositePlug.prototype.validateMapOptions = function (mapname, options) {
	options.maps = options.maps || [];
	//TODO: check if png format
};

CompositePlug.prototype.getImage = function (treq, options) {
	var buffers = [];
	var finish = treq.finish;
	var q = async.queue(function (m, callback) {
		var map = treq.lhc.getMap(m.name);
		if (!map) {
			treq.finish = finish;
			return treq.finish('composite map ' + m.name + ' not known :.(');
		}
		//TODO: check if png format
		treq.finish = function (err, buffer) {
			if (err) {
				console.log(err);
				treq.finish = finish;
				return treq.finish(err);
			}
			buffers.push({
				buffer: buffer,
				map: map
			});
			callback();
		};
		map.getImage(treq);
	}, 1);
	q.drain = function () {
		var img = images(256, 256);
		buffers.forEach(function (buf) {
			img.draw(images(buf.buffer), 0, 0);
		});
		var buffer = img.encode('png');
		treq.finish = finish;
		treq.finish(null, buffer);
	};
	q.push(options.maps);
};

exports.Plug = CompositePlug;