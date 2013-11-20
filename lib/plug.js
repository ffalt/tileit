function BaseStorage() {

}

BaseStorage.prototype.hasValidParams = function (mapname, x, y, z, format) {
	return true;
};

BaseStorage.prototype.getStats = function () {
	return {};
};

BaseStorage.prototype.wantsStorage = function (mapname) {
	return false;
};

BaseStorage.prototype.isKnownMap = function (mapname) {
	return true;
};

BaseStorage.prototype.getImage = function (mapname, x, y, z, format, cb) {
	cb('not implemented')
};

BaseStorage.prototype.storeImage = function (mapname, x, y, z, format, data, cb) {
	cb('not implemented');
};

exports.BaseStorage = BaseStorage;