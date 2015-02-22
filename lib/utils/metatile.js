var path = require('path')
	, fs = require('fs')
	, mkdirp = require('mkdirp')
	, Struct = require('struct').Struct;

var EARTH_RADIUS = 6378137;
var EARTH_DIAMETER = EARTH_RADIUS * 2;
var EARTH_CIRCUMFERENCE = EARTH_DIAMETER * Math.PI;
var MAX_RES = EARTH_CIRCUMFERENCE / 256;
var ORIGIN_SHIFT = EARTH_CIRCUMFERENCE / 2;


/**
 * Metatile-Handling
 * http://wiki.openstreetmap.org/wiki/Tirex/Overview#Metatiles
 */

function MetaTileTile(x, y, z) {
	this.x = x;
	this.y = y;
	this.z = z;
}

function MetaTile(x, y, z, options) {
	this.metatile = options.metaTileCount || 8;

	var total = 1 << z;
	var resolution = MAX_RES / total;

	// Make sure we start at a metatile boundary.
	x -= x % this.metatile;
	y -= y % this.metatile;
	this.x = x;
	this.y = y;
	this.z = z;

	// Make sure we don't calculcate a metatile that is larger than the bounds.
	if (!options.tirex) {
		this.metaWidth = Math.min(this.metatile, total, total - x);
		this.metaHeight = Math.min(this.metatile, total, total - y);
	} else {
		this.metaWidth = this.metatile;
		this.metaHeight = this.metatile;
	}
	this.tileSize = options.tileSize;
	var minx = (x * 256) * resolution - ORIGIN_SHIFT;
	var miny = -((y + this.metaHeight) * 256) * resolution + ORIGIN_SHIFT;
	var maxx = ((x + this.metaWidth) * 256) * resolution - ORIGIN_SHIFT;
	var maxy = -((y * 256) * resolution - ORIGIN_SHIFT);
	this.bbox = [minx, miny, maxx, maxy];
	this.width = this.metaWidth * this.tileSize;
	this.height = this.metaHeight * this.tileSize;
	// Generate all tile coordinates that are within the metatile.
	this.tiles = [];
	for (var dx = 0; dx < this.metaWidth; dx++) {
		for (var dy = 0; dy < this.metaHeight; dy++) {
			var tile = new MetaTileTile(x + dx, y + dy, z);
			this.tiles.push(tile);
		}
	}
}

MetaTile.prototype.calcPos = function (x, y) {
	return (((x - this.x) % this.metaHeight) * this.metaHeight) + (y - this.y);
};

MetaTile.prototype.getTiles = function () {
	return this.tiles;
};

MetaTile.prototype.getTile = function (x, y) {
	return this.tiles[this.calcPos(x, y)];
};

MetaTile.prototype.openFile = function (rootdir, cb) {
	var caller = this;
	var imgfile = path.join(rootdir, this.getFilename());
	fs.open(imgfile, 'r', null, function (err, fd) {
		if (err) {
			cb(err);
		} else {
			var Header = caller.initHeader(caller.metatile);
			var buf = Header.buffer();
			var length = Header.length();
			fs.read(fd, buf, 0, length, 0, function (err, bytesRead) {
				var fields = Header.fields;
				if (err || bytesRead !== length) {
					cb('Metatile Header error :.(', err, bytesRead);
					fs.close(fd);
				} else if (fields.magic != 'META') {
					cb('Metatile Header error :.(');
					fs.close(fd);
				} else {
					cb(null, {
						fd: fd,
						header: fields
					});
				}
			});

		}
	});
};

MetaTile.prototype.readFileTile = function (tile, file, cb) {
	var index = this.calcPos(tile.x, tile.y);
	var offset = file.header.offsets[index].offset;
	var size = file.header.offsets[index].size;
	try {
		var buffer = new Buffer(size);
		fs.read(file.fd, buffer, 0, size, offset, function (err, bytesRead) {
			if (err || bytesRead !== size) {
				cb('Metatile error :.( ' + err + ' ' + bytesRead + '==' + size);
			} else {
				cb(null, buffer);
			}
		});
	} catch (e) {
		cb('Metatile error :.( ' + e.toString() + ' ' + this.getFilename() + ' offset: ' + offset + ' size: ' + size);
	}
};

MetaTile.prototype.closeFile = function (file) {
	fs.close(file.fd);
};

/**
 struct entry {
	 int offset;
	 int size;
 };

 struct meta_layout {
	 char magic[4];
	 int count; // METATILE ^ 2
	 int x, y, z; // lowest x,y of this metatile, plus z
	 struct entry index[]; // count entries
 };

 **/

MetaTile.prototype.initHeader = function (metatile) {
	var Offset = Struct()
		.word32Sle('offset')
		.word32Sle('size');

	var Header = Struct()
		.chars('magic', 4)
		.word32Ule('count')
		.word32Ule('x')
		.word32Ule('y')
		.word32Ule('z')
		.array('offsets', metatile * metatile, Offset);
	Header.allocate();

	return Header;
};

MetaTile.prototype.saveFile = function (rootdir, getbuffer, cb) {
	var imgfile = path.join(rootdir, '/', this.getFilename());
	var caller = this;
	mkdirp(path.dirname(imgfile), function (err) {
		if (err) {
			return cb(err);
		} else {
			var Header = caller.initHeader(caller.metatile);
			var proxy = Header.fields;
			proxy.magic = 'META';
			proxy.count = caller.tiles.length;
			proxy.x = caller.x;
			proxy.y = caller.y;
			proxy.z = caller.z;

			var offset = Header.length();

			var i = 0;
			caller.tiles.map(function (tile) {
				var buffer = getbuffer(tile);
				proxy.offsets[i].offset = offset;
				proxy.offsets[i].size = buffer.length;
				offset += buffer.length;
				i++;
			});

			try {
				var list = [];
				list.push(Header.buffer());
				caller.tiles.forEach(function (tile) {
					list.push(getbuffer(tile));
				});
				fs.writeFile(imgfile + '_', Buffer.concat(list), function (err) {
					if (err) {
						global.logger.error('[File] Could not save file: ', imgfile + '_', err)
						try {
							fs.unlinkSync(imgfile + '_');
						}
						catch (ex) {
						}
						cb(err);
					} else {
						fs.rename(imgfile + '_', imgfile, function () {
							cb();
						});
					}
				});
			} catch (e) {
				cb(err);
			}
		}
	});
};

MetaTile.prototype.getFilename = function () {
	var path_components = [], i, v;
	var x = this.x;
	var y = this.y;
	for (i = 0; i <= 4; i++) {
		v = x & 0x0f;
		v <<= 4;
		v |= (y & 0x0f);
		x >>= 4;
		y >>= 4;
		path_components.unshift(v);
	}
	path_components.unshift(this.z);
	return path_components.join('/') + '.meta';
};

exports.MetaTile = MetaTile;