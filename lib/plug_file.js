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

function File(name, settings) {
	this.name = name;
	this.settings = settings;
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
			fs.readFile(tile_file, treq.finish);
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
	var tile_file = this.tile_filename(treq.mapname, treq.x, treq.y, treq.z, options.format || treq.format, options);
	/* mkdirp for local file */
	mkdirp(path.dirname(tile_file), function (err) {
		if (err) {
			global.logger.error("[File] Could not create directory", path.dirname(tile_file), err);
			return cb(err);
		} else {
			fs.writeFile(tile_file + '_', data, function (err) {
				if (err) {
					global.logger.error('[File] Could not save file: ', tile_file + '_', err);
					try {
						fs.unlinkSync(tile_file + '_');
					} catch (ex) {}
					cb(err);
				} else {
					fs.rename(tile_file + '_', tile_file, function () {
						global.logger.debug('[File] File stored', tile_file);
						cb();
					});
				}
			});
		}
	});
};

exports.Plug = File;