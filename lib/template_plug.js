function TemplatePlug(name, settings) {
	this.name = name;
	this.settings = settings;
}

TemplatePlug.prototype.validateMapOptions = function (mapname, options) {
	//modify options as needed, they will be given to getImage/storeImage
};

TemplatePlug.prototype.getImage = function (treq, options) {
	// treq.mapname, treq.x, treq.y, treq.z, treq.format, treq.lhc
	// treq.finish = function(err, buffer}
	treq.finish('not implemented');
};

TemplatePlug.prototype.storeImage = function (treq, data, cb) {
	cb('not implemented');
};

exports.Plug = TemplatePlug;