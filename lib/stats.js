function Stats(name) {
	this.name = name;
	this.maps = {};
}

Stats.prototype.missing = function (mapname) {
	this.validateMapStat(mapname);
	this.maps[mapname].missing++;
};

Stats.prototype.requested = function (mapname) {
	this.validateMapStat(mapname);
	this.maps[mapname].requested++;
};

Stats.prototype.processed = function (mapname) {
	this.validateMapStat(mapname);
	this.maps[mapname].processed++;
};

Stats.prototype.served = function (mapname) {
	this.validateMapStat(mapname);
	this.maps[mapname].served++;
};

Stats.prototype.validateMapStat = function (mapname) {
	this.maps[mapname] = this.maps[mapname] || {requested: 0, served: 0, processed: 0, missing: 0};
};

Stats.prototype.getStats = function () {
	return this;
};

exports.Stats = Stats;