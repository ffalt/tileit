function TemplatePlug(name, settings) {
	this.name = name;
	this.settings = settings;
}

TemplatePlug.prototype.validateMapOptions = function (mapname, options) {
	//modify options as needed, they will be given to getImage/storeImage
};

// cb = function(err, {filename: "filename if file", buffer: "data if buffer", format: "format of data"}

TemplatePlug.prototype.getImage = function (treq) {
	treq.finish('not implemented');
	// treq.mapname, treq.x, treq.y, treq.z, treq.format
};

TemplatePlug.prototype.storeImage = function (treq, data, cb) {
	cb('not implemented');
};

exports.Plug = TemplatePlug;