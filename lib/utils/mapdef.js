var path = require("path");
var fs = require("fs");

function Mapdef() {

}

Mapdef.scanMaps = function (mapspath, tirexpath, cb) {
	//load maps from config files
	var maps = {};

	var addMapDefs = function (mapdefs, isTirex) {
		if (!mapdefs)
			return;
		for (var key in mapdefs) {
			var newmap = mapdefs[key];
			if (maps[key]) {
				if (isTirex) {
					var oldmap = maps[key];
					var newtirex = newmap.sources[0];
					var found = false;
					for (var i = 0; i < oldmap.sources.length; i++) {
						if (oldmap.sources[i].plug == 'tirex') {
							oldmap.sources[i] = newtirex;
							found = true;
						}
					}
					if (!found) {
						oldmap.sources.push(newtirex);
					}
					oldmap.name = newtirex.name;
					oldmap.maxz = newtirex.maxz;
					oldmap.minz = newtirex.minz;
					oldmap.format = 'png';
					console.log('Merged Tirex Mapdef: ' + key);
				} else {
					console.log('Warning: Duplicate Mapname ' + key);
					maps[key] = newmap;
				}
			} else {
				maps[key] = newmap;
			}
		}
	};

	var files = fs.readdirSync(mapspath);
	for (var i = 0; i < files.length; i++) {
		var ext = path.extname(files[i]).toLocaleLowerCase();
		if (ext == '.json') {
			var obj = JSON.parse(fs.readFileSync(mapspath + '/' + files[i]).toString());
			addMapDefs(obj);
		} else if (ext == '.js') {
			var jsmaps = require(mapspath + '/' + files[i]).maps;
			addMapDefs(jsmaps)
		}
	}

	if (tirexpath) {
		Mapdef.scanTirexMaps(tirexpath, function (tmaps) {
			addMapDefs(tmaps, true);
			cb(maps);
		});
	} else {
		cb(maps);
	}
};

Mapdef.prototype.scanTirexMaps = function (tirexpath, cb) {
	var maps = {};
	var renderers = fs.readdirSync(tirexpath);
	var i, j;
	for (i = 0; i < renderers.length; i++) {
		var rdir = tirexpath + renderers[i];
		if (fs.statSync(rdir).isDirectory()) {
			var files = fs.readdirSync(rdir);
			for (j = 0; j < files.length; j++) {
				var mapfile = rdir + '/' + files[j];
				var cfg = fs.readFileSync(mapfile).toString();
				var lines = cfg.split('\n');
				var tmap = {minz: 0, maxz: 0};
				lines.forEach(function (line) {
					if (!line.match('^#') && !line.match('^$')) {
						var kv = line.split('=');
						tmap[kv[0]] = kv[1];
					}
				});
				if (tmap.name) {
					maps[map.name] = {
						name: tmap.name,
						maxz: tmap.maxz,
						minz: tmap.minz,
						format: 'png',
						source: {
							"tirex": tmap
						}
					};
				}
			}
		}
	}
	cb(maps);
};

exports.mapdef = Mapdef;