function TemplatePlug() {

}

TemplatePlug.prototype.validateMapOptions = function (mapname, options) {
	//modify options as needed, they will be given to getImage/storeImage
};

// cb = function(err, {filename: "filename if file", buffer: "data if buffer", format: "format of data"}

TemplatePlug.prototype.getImage = function (mapname, x, y, z, format, cb) {
	cb('not implemented')
};

TemplatePlug.prototype.storeImage = function (mapname, x, y, z, format, data, cb) {
	cb('not implemented');
};

exports.Plug = TemplatePlug;