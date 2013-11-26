var buildMap = function () {
	return {
		"minz": 11,
		"maxz": 18,
		"source": {
			"memcached": {},
			"file": {}
		}
	};
};

var maps = {};
for (var i = 1; i < 11; i++) {
	maps["demo_map_" + i] = buildMap();
}
exports.maps = maps;