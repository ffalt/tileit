var buildMap = function (maps, name, format, mapnikformat) {
	maps[name] = {
		"format": format,
		"category": "Examples",
		"sources": [
			{
				"plug": "mapnik",
				"format": mapnikformat,
				"xml": "./data/mapnik/demo1/demo.xml",
				"metaTileCount": 8, // metatile row=col count
				"tilesPath": "./data/xyz.meta/" + name   //must define if metaTileCount>0 or cairo fileformat
			}
		]
	};
};

var maps = {};
buildMap(maps, 'demo_jpeg40', 'jpeg', 'jpeg40');
buildMap(maps, 'demo_jpeg60', 'jpeg', 'jpeg60');
buildMap(maps, 'demo_jpeg80', 'jpeg', 'jpeg80');
buildMap(maps, 'demo_jpeg100', 'jpeg', 'jpeg100');
buildMap(maps, 'demo_jpeg', 'jpeg', 'jpeg');
buildMap(maps, 'demo_png8', 'png', 'png8');
buildMap(maps, 'demo_png32', 'png', 'png32');
buildMap(maps, 'demo_png', 'png', 'png');
buildMap(maps, 'demo_png8c2', '', 'png8:c=2');
buildMap(maps, 'demo_png8c4', '', 'png8:c=4');
buildMap(maps, 'demo_png8c8', '', 'png8:c=8');
buildMap(maps, 'demo_svg', 'svg', 'svg');
buildMap(maps, 'demo_tiff', 'tiff', 'tiff');

exports.maps = maps;