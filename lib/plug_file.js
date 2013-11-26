var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

function File(settings) {
	this.settings = settings;
}

File.prototype.tile_filename = function (mapname, x, y, z, format, options) {
	var tile_path = options.path || this.settings.path + '/' + mapname;
	return path.resolve(tile_path, [z, x, y].join('/') + '.' + format);
};

File.prototype.getImage = function (mapname, x, y, z, format, options, cb) {
	var tile_file = this.tile_filename(mapname, x, y, z, format, options);
	fs.exists(tile_file, function (e) {
		if (e) {
			cb(null, {filename: tile_file});
		} else {
			cb('not found')
		}
	});
};

File.prototype.storeImage = function (mapname, x, y, z, format, data, options, cb) {
	var tile_file = this.tile_filename(mapname, x, y, z, format, options);
	fs.exists(tile_file, function (e) {
		if (!e) {
			/* mkdirp for local file */
			mkdirp(path.dirname(tile_file), function (err) {
				if (err) {
					console.error("[File] Could not create directory", path.dirname(tile_file), err);
					return cb(err);
				} else {
					fs.writeFile(tile_file, data, function (err) {
						if (err) {
							console.error('[File] Could not save file: ', tile_file, err)
						} else {
							console.debug('[File] File stored', tile_file);
						}
						cb(err);
					});
				}
			});
		} else {
			cb();
		}
	})
};

exports.Plug = File;