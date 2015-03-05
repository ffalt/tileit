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
		me.plugs = new Plugs(config.plugs);
		me.lhc = new Machine();
		me.lhc.init(me.plugs, config, cb);
	};
	me.addMap = function (opts) {
		return me.lhc.addMap(opts, me.plugs);
	};
	me.getMap = function (mapname) {
		return me.lhc.getMap(mapname);
	};
	me.removeMap = function (mapname) {
		var map = me.lhc.getMap(mapname);
		if (map) {
			me.lhc.removeMap(map);
			for (var key in me.plugs) {
				if (me.plugs[key].clearCache)
					me.plugs[key].clearCache(mapname);
			}
		}
	};
	me.get = function (mapname, x, y, z, format, cb) {
		var map = me.lhc.getMap(mapname);
		if (!map) return cb('Unknown map');
		var treq = {
			mapname: mapname, x: x, y: y, z: z, format: format,
			finish: cb, lhc: me.lhc
		};
		map.getImage(treq);
	};
};

module.exports.TileIt = TileIt;
