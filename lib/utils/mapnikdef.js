/**
 * The Mapnik Format
 *        - converting from xml to json
 *        - converting from json to xml
 *        - applying json to node-mapnik
 */

//------------------------------------------------------------
// A demo json map spec

var
	demo_spec = {
		"options": {
			"srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over",
			"background-color": "#81c2f0",
			"maximum-extent": "-20037508.34,-20037508.34,20037508.34,20037508.34"
		},
		"fontsets": [
			{
				"fonts": ["Open Sans Semibold", "DejaVu Sans Book", "unifont Medium"],
				"name": "demo_fontset"
			}
		],
		"styles": [
			{
				"options": {
					"name": "demo_style",
					"filter-mode": "first" // https://github.com/mapnik/mapnik/wiki/AlsoFilter
				},
				"rules": [
					{
						"options": {
							"filter": "([NotLive] = 0)"
						},
						"symbolizers": [
							{
								// https://github.com/mapnik/mapnik/wiki/PolygonSymbolizer
								"type": "poly",

								"fill": "#000000", // default: "black"
								"fill-opacity": "1.0", // range: "0.0 - 1.0", default: "1"
								"gamma": "0.75" // range: "0.0 - 1.0", default: "1"
							},
							{
								// https://github.com/mapnik/mapnik/wiki/LineSymbolizer
								"type": "line",
								"stroke": "#000000", // default: "black"
								"stroke-width": "1.0", // range: "0.0 - n", unit: "pixels", default: 1.0
								"stroke-opacity": "1.0", // range: "0.0 - 1.0", default:"1.0"
								"stroke-linejoin": "miter", // values: ["miter", "round", "bevel"] default: "miter"
								"stroke-linecap": "butt", // values: ["round", "butt", "square"], default: "butt"
								"stroke-dasharray": "1,1" // ranges: "0.0 - n,0.0 - n", default: none
							},
							{
								// https://github.com/mapnik/mapnik/wiki/TextSymbolizer
								"type": "text",
								"content": "[name]",

								"text-ratio": "1.0", // default: "0"
								"wrap-width": "1.0", // default: "0"
								"wrap-before": "true", // default: "false"
								"spacing": "1.0", // default: "0"
								"label-position-tolerance": "1.0", // default: "0"
								"force-odd-labels": "true", // default: "false"
								"max-char-angle-delta": "22.5", // default: "22.5"
								"dx": "1.0", // default: "0.0"
								"dy": "1.0", // default: "0.0"
								"avoid-edges": "true", // default: "false"
								"minimum-distance": "1.0", // default: "0.0"
								"allow-overlap": "true", // default: "false"
								"placement": "point",  // values: ["line", "point", "vertex", "interior"], default: "point"
								"vertical-alignment": "auto",  // values: ["top", "middle", "bottom", "auto"], default: "auto"
								"horizontal-alignment": "auto",  // values: ["left", "middle", "right", "auto"], default: "auto"
								"justify-alignment": "auto",  // values: ["left", "middle", "right", "auto"], default: "auto"
								"opacity": "1.0", // range: "0.0 - 1.0", default:"1.0"
								"minimum-padding": "1.0", // default:"0.0"
								"minimum-path-length": "1.0", // default:"0.0"
								"orientation": "0", // default: "0"
								"rotate-displacement": "true", // default: "false"
								"placement-type": "dummy",  // values: ["dummy", "simple", "list"]
								"placements": "X", //default: "X"
								"upright": "auto", // values: {"left", "right", "auto", "left_only", "right_only"}, default:"auto"
								"clip": "false", // default: "true"
								"largest_bbox_only": "false", // default: "true"

								"face-name": "Comic Sans",
								"fontset-name": "demo_fontset",
								"size": "12", //default: "10.0"
								"fill": "#666666", //default: "black"
								"halo-fill": "rgba(243, 243, 243, 0.6599999999999999)", //default: "white"
								"halo-radius": "2", //default: "0"
								"character-spacing": "1", //default: "0"
								"line-spacing": "2", //default: "0"
								"wrap-character": "#", //default: " "
								"text-transform": "uppercase" //values: ["none", "uppercase", "lowercase", "capitalize"], default: "none"
							}
						]
					}
				]
			}
		],
		"layers": [
			{
				"options": {
					"name": "demo_layer",
					"status": "on",
					"srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over"
				},
				"styles": ["demo_style"],
				"datasource": "demo_source"
			}
		],
		"sources": [
			{
				// https://github.com/mapnik/mapnik/wiki/ShapeFile
				"name": "demo_source",
				"type": "shape",
				"encoding": "ISO8859-1",
				"file": "/var/www/demopath/data/shapes/demo/demo.shp"
			},
			{
				// https://github.com/mapnik/mapnik/wiki/OGR
				"name": "demo_source_geojson",
				"type": "ogr",
				"file": "/var/www/demopath/data/geojson/demo.json",
				"project": "demodata",
				"id": "demodatafield",
				"layer_by_index": "0"
			},
			{
				// https://github.com/mapnik/mapnik/wiki/PostGIS
				"name": "demo_source_postgis",
				"type": "postgis",
				"extent": "-20037508.34 -20037508.34 20037508.34 20037508.34",
				"geometry_field": "geometry",
				"host": "localhost",
				"port": "5432",
				"dbname": "planet",
				"user": "osm_user",
				"password": "osm_pass",
				"project": "foss4g-2011",
				"id": "waterway_label",
				"srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over",
				"table": "( SELECT geometry, type, name\n  FROM osm_waterways\n  WHERE type IN ('canal', 'river', 'stream') \n    AND name IS NOT NULL\n) AS data"
			}
		]
	};

//------------------------------------------------------------

function MapnikDefs() {

}

//------------------------------------------------------------
//http://wiki.openstreetmap.org/wiki/MinScaleDenominator

var zoomsLevelsFixed = {
	'0': 1000000000,
	'1': 500000000,
	'2': 200000000,
	'3': 100000000,
	'4': 50000000,
	'5': 25000000,
	'6': 12500000,
	'7': 6500000,
	'8': 3000000,
	'9': 1500000,
	'10': 750000,
	'11': 400000,
	'12': 200000,
	'13': 100000,
	'14': 50000,
	'15': 25000,
	'16': 12500,
	'17': 5000,
	'18': 2500,
	'19': 1500,
	"20": 750,
	"21": 500,
	"22": 250,
	"23": 100,
	"24": 0
};

var zoomLevels = {
	"0": 559082264,
	"1": 279541132,
	"2": 139770566,
	"3": 69885283,
	"4": 34942642,
	"5": 17471321,
	"6": 8735660,
	"7": 4367830,
	"8": 2183915,
	"9": 1091958,
	"10": 545979,
	"11": 272989,
	"12": 136495,
	"13": 68247,
	"14": 34124,
	"15": 17062,
	"16": 8531,
	"17": 4265,
	"18": 2133,
	"19": 1066,
	"20": 533,
	"21": 400,
	"22": 200,
	"23": 50,
	"24": 0
};

function maxzoom2MaxScaleDenominator(val) {
	return zoomsLevelsFixed[val.toString()];
}

function minzoom2MinScaleDenominator(val) {
	return zoomsLevelsFixed[(parseInt(val) + 1).toString()];
}

function MaxScaleDenominator2maxzoom(val) {
	for (var i = 0; i < 24; i++) {
		if (val > zoomLevels[i.toString()]) {
			return i;
		}
	}
	return -1;
}

function MinScaleDenominator2minzoom(val) {
	for (var i = 0; i < 24; i++) {
		if (val > zoomLevels[i.toString()]) {
			return i - 1;
		}
	}
	return -1;
}

//------------------------------------------------------------

/**
 * build a map from node-mapnik by mapdef-json
 *
 * @param mapnik - provided by:: var mapnik = require('mapnik');
 * @param map - created with:: new mapnik.Map()
 * @param mapdef - the mapnik map definition json
 */

MapnikDefs.build = function (map, mapnik, mapdef) {
	map.fromStringSync(MapnikDefs.mapdef2xml(mapdef, false));
	var dss = {};
	for (var i = 0; i < mapdef.sources.length; i++) {
		var src = mapdef.sources[i];
		dss[src.name] = new mapnik.Datasource(src);
	}
	for (i = 0; i < mapdef.layers.length; i++) {
		var layer = mapdef.layers[i];
		var l = new mapnik.Layer(layer.name);
		l.srs = layer.srs;
		l.styles = layer.styles;
		l.datasource = dss[layer.source];
		map.add_layer(l);
	}
	map.zoomAll();
};

/**
 * output a xml-string from mapdef-json
 *
 * @param mapdef - the mapnik map definition json
 * @param full - [true = with datasources & layers|false = styles only];
 */

MapnikDefs.mapdef2xml = function (mapdef, full) {

	var attr = function (name, value) {
		if (value)
			return ' ' + name + '="' + value + '"';
		return '';
	};

	var attrs = function (obj, exlude) {
		var result = '';
		exlude = exlude || [];
		for (var key in obj) {
			if (exlude.indexOf(key) < 0)
				result += attr(key, obj[key]);
		}
		return result;
	};

	var cdata = function (s) {
		return '<![CDATA[' + s + ']]>';
	};

	var symbolizerToXML = function (symb) {
		switch (symb.type) {
			case 'line':
				return '<LineSymbolizer' + attrs(symb, ['type']) + ' />';
				break;
			case 'poly':
				return '<PolygonSymbolizer' + attrs(symb, ['type']) + ' />';
				break;
			case 'text':
				return '<TextSymbolizer' + attrs(symb, ['type', 'content']) + '>' + cdata(symb.content) + '</TextSymbolizer>';
				break;
		}
		return '';
	};

	var ruleToXML = function (rule) {
		var s = '<Rule>';
		rule.options = rule.options || {};
		if (!isNaN(rule.options.maxzoom))
			s += '<MaxScaleDenominator>' + maxzoom2MaxScaleDenominator(rule.options.maxzoom) + '</MaxScaleDenominator>';
		if (!isNan(rule.options.minzoom))
			s += '<MinScaleDenominator>' + minzoom2MinScaleDenominator(rule.options.minzoom) + '</MinScaleDenominator>';
		if (rule.options.filter)
			s += '<Filter>' + cdata(rule.options.filter) + '</Filter>';
		for (var i = 0; i < rule.symbolizers.length; i++)
			s += symbolizerToXML(rule.symbolizers[i]);
		s += '</Rule>';
		return s;
	};

	var styleToXML = function (style) {
		var s = '<Style' + attrs(style.options) + '>';
		for (var i = 0; i < style.rules.length; i++)
			s += ruleToXML(style.rules[i]);
		s += '</Style>';
		return s;
	};

	var p = '';
	var s = '<Map'
	for (var key in mapdef.options) {
		if (['srs', 'background-color', 'maximum-extent'].indexOf(key) < 0) {
			p += '<Parameter' + attr('name', key) + '>' + cdata(mapdef.options[key]) + '</Parameter>';
		} else {
			s += attr(key, mapdef.options[key]);
		}
	}
	s += '>';
	if (p.length)
		s += '<Parameters>' + cdata(p) + '</Parameters>';

	if (mapdef.fontsets.length) {
		for (var j = 0; j < mapdef.fontsets.length; j++) {
			var fontset = mapdef.fontsets[j];
			s += '<FontSet' + attr('name', fontset.name) + '>';
			for (var i = 0; i < fontset.fonts.length; i++)
				s += '<Font' + attr('face-name', fontset.fonts[i]) + ' />';
			s += '</FontSet>';
		}
	}
	for (var k = 0; k < mapdef.styles.length; k++) {
		s += styleToXML(mapdef.styles[k]);
	}
	var la = '';
	if (full) {
		for (var m = 0; m < mapdef.layers.length; m++) {
			var layer = mapdef.layers[m];
			la += '<Layer' + attrs(layer, ['styles', 'source']) + '>';
			for (var n = 0; n < layer.styles.length; n++) {
				la += '<StyleName>' + layer.styles[n] + '</StyleName>';
			}
			var src = mapdef.sources.filter(function (source) {
				return (source.name === layer.source);
			})[0];

			la += '<Datasource>';
			for (var key in src) {
				la += '<Parameter name="' + key + '">' + cdata(src[key]) + '</Parameter>';
			}
			la += '</Datasource>';
		}
	}
	s += la + '</Map>';
	return s;
};

/**
 * convert the json output of a mapnik-xml from package "xmljs2json" to a mapdef-json
 *
 * @param xmljson - mapnik xml as json
 */

MapnikDefs.xmljs2mapdef = function (xmljson) {

	var result = {
		options: {},
		layers: [],
		styles: [],
		fontsets: [],
		sources: []
	};

	var copyAttrs = function (xmljson, dest) {
		if (xmljson['$'])
			for (var key in xmljson['$']) {
				dest[key] = xmljson['$'][key];
			}
	};

	var buildrule = function (xmlrule) {
		var rule = {options: {}, symbolizers: []};
		for (var key in xmlrule) {
			if (key == "Filter") {
				rule.options.filter = xmlrule["Filter"][0];
			} else if (key == "LineSymbolizer") {
				var symb = xmlrule[key][0]["$"];
				symb.type = 'line';
				rule.symbolizers.push(symb);
			} else if (key == "PolygonSymbolizer") {
				var symb = xmlrule[key][0]["$"];
				symb.type = 'poly';
				rule.symbolizers.push(symb);
			} else if (key == "TextSymbolizer") {
				var symb = xmlrule[key][0]["$"];
				symb.type = 'text';
				symb.content = xmlrule[key][0]["_"];
				rule.symbolizers.push(symb);
			} else if (key == "MaxScaleDenominator") {
				var val = xmlrule[key][0];
				rule.options.maxzoom = MaxScaleDenominator2maxzoom(val);
			} else if (key == "MinScaleDenominator") {
				var val = xmlrule[key][0];
				rule.options.minzoom = MinScaleDenominator2minzoom(val);
			}
		}
		return rule;
	};

	var buildsource = function (layername, xmlsource) {
		var source = {
			name: (layername || 'datasource') + '_src_' + result.sources.length
		};
		var params = xmlsource['Parameter'];
		if (params)
			params.forEach(function (param) {
				var name = param['$']['name'];
				source[name] = param["_"];
			});
		result.sources.push(source);
		return source.name;
	};

	var buildlayer = function (xmllayer) {
		var layer = {options: {}};
		copyAttrs(xmllayer, layer.options);

		for (var key in xmllayer) {
			if (key == "StyleName") {
				layer.styles = xmllayer["StyleName"];
			} else if (key == "Datasource") {
				layer.datasource = buildsource(layer.name, xmllayer["Datasource"][0]);
			}
		}
		return layer;
	};

	var buildstyle = function (xmlstyle) {
		var style = {options: {}, rules: []};
		copyAttrs(xmlstyle, style.options);
		var rules = xmlstyle['Rule'];
		if (rules) {
			rules.forEach(function (xmlrule) {
				style.rules.push(buildrule(xmlrule));
			});
		}
		return style;
	};

	var buildfontset = function (xmlfontset) {
		var fontset = {fonts: []};
		copyAttrs(xmlfontset, fontset);
		var fonts = xmlfontset['Font'];
		if (fonts) {
			fonts.forEach(function (xmlfont) {
				fontset.fonts.push(xmlfont['$']["face-name"]);
			});
		}
		return fontset;
	};

	var map = xmljson['Map'];
	copyAttrs(map, result.options);

	if (map['Parameters'] && map['Parameters'].length > 0) {
		var params = map['Parameters'][0]['Parameter'];
		if (params)
			params.forEach(function (param) {
				var name = param['$']['name'];
				result.options[name] = param["_"];
			});
	}

	var styles = map['Style'];
	if (styles)
		styles.forEach(function (xmlstyle) {
			result.styles.push(buildstyle(xmlstyle));
		});

	var layers = map['Layer'];
	if (layers)
		layers.forEach(function (xmllayer) {
			result.layers.push(buildlayer(xmllayer));
		});

	var fos = map['FontSet'];
	if (fos)
		fos.forEach(function (xmlfontset) {
			result.fontsets.push(buildfontset(xmlfontset));
		});

	return result;
};

//------------------------------------------------------------

exports.MapnikDefs = MapnikDefs;