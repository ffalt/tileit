var
	Machine = require(__dirname + "/lib/machine.js").Machine
	, Plugs = require(__dirname + "/lib/plugs.js").Plugs
	, Projections = require(__dirname + "/lib/utils/projections.js").Projections
	;

function Logger() {
	var me = this;
	var empty = function (e) {
	};
	this.info = console.log;
	this.warn = console.log;
	this.error = console.log;
	this.debug = empty;
	this.logfail = empty;
	this.logrequest = empty;
	this.logrequestend = empty;
	this.logtile = empty;
	this.logrender = empty;
}

global.logger = new Logger();

function TileIt() {
	var me = this;
	me.init = function (config, cb) {
		var plugs = new Plugs(config.plugs);
		me.lhc = new Machine();
		me.lhc.init(plugs, config, cb);
	};
	me.addMap = function (opts) {
		return me.lhc.addMap(opts);
	};
	me.get = function (mapname, x, y, z, format, cb) {
		var map = me.lhc.getMap(mapname);
		if (!map) return cb('Unknown map');
		var treq = {
			mapname: mapname, x: x, y: y, z: z, format: format,
			finish: cb
		};
		map.getImage(treq);
	};
};

module.exports.TileIt = TileIt;
