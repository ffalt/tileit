function Plugs(config) {
	var plugs = {};
	for (var plugname in config) {
		if (config[plugname].enabled) {
			var Plug = require(__dirname + '/plug_' + plugname + '.js').Plug;
			plugs[plugname] = new Plug(plugname, config[plugname]);
		}
	}
	return plugs;
}

module.exports.Plugs = Plugs;