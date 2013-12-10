var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

/**
 * The File Plug for loading and storing tiles in a path
 * Disk-Layout:
 * [path]/[mapname]/[z]/[x]/[y].[format]
 *
 * @param settings from config.js
 * @constructor
 */

function File(name, settings, logger) {
	this.name = name;
	this.settings = settings;
	this.logger = logger;
}

/**
 * convert request parameter to path & filename
 */

File.prototype.tile_filename = function (mapname, x, y, z, format, options) {
	var tile_path = options.path || this.settings.path + '/' + mapname;
	return path.resolve(tile_path, [z, x, y].join('/') + '.' + format);
};

/**
 * checks if file exist and answer request
 */

File.prototype.getImage = function (treq, options) {
	var tile_file = this.tile_filename(treq.mapname, treq.x, treq.y, treq.z, options.format || treq.format, options);
	fs.exists(tile_file, function (e) {
		if (e) {
			fs.readFile(tile_file, function (err, buffer) {
				treq.finish(err, buffer);
			});
		} else {
			treq.finish('file not found');
		}
	});
};

File.prototype.getStoragePath = function (mapname, options) {
	return options.path || this.settings.path + '/' + mapname;
};

/**
 * create the path if needed & save the image
 */

File.prototype.storeImage = function (treq, data, options, cb) {
	var caller = this;
	var tile_file = this.tile_filename(treq.mapname, treq.x, treq.y, treq.z, options.format || treq.format, options);
//	fs.exists(tile_file, function (e) {
//		if (!e) {
	/* mkdirp for local file */
	mkdirp(path.dirname(tile_file), function (err) {
		if (err) {
			caller.logger.error("[File] Could not create directory", path.dirname(tile_file), err);
			return cb(err);
		} else {
			fs.writeFile(tile_file, data, function (err) {
				if (err) {
					caller.logger.error('[File] Could not save file: ', tile_file, err)
				} else {
					caller.logger.debug('[File] File stored', tile_file);
				}
				cb(err);
			});
		}
	});
//		} else {
//			cb();
//		}
//	})
};

exports.Plug = File;