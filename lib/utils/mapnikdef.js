//------------------------------------------------------------

function attr(name, value) {
	if (value)
		return ' ' + name + '="' + value + '"';
	return '';
}

var attrs = function (obj, exlude) {
	var result = '';
	exlude = exlude || [];
	for (var key in obj) {
		if (exlude.indexOf(key) < 0)
			result += attr(key, obj[key]);
	}
	return result;
};

//------------------------------------------------------------

function MapnikDefs() {

}

//------------------------------------------------------------

var zoomsStart = {
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
	'18': 2500
};
var zoomsEnds = {
	'0': 1000000000,
	'1': 200000000,
	'2': 100000000,
	'3': 50000000,
	'4': 25000000,
	'5': 12500000,
	'6': 6500000,
	'7': 3000000,
	'8': 1500000,
	'9': 750000,
	'10': 400000,
	'11': 200000,
	'12': 100000,
	'13': 50000,
	'14': 25000,
	'15': 12500,
	'16': 5000,
	'17': 2500,
	'18': 1500
};

//------------------------------------------------------------

MapnikDefs.build = function (map, mapnik, mapdef) {
	map.fromStringSync(MapnikDefs.toXML(mapdef, false));
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

MapnikDefs.toXML = function (mapdef, full) {

	var symbolizerToXML = function (symb) {
		switch (symb.type) {
			case 'line':
				return '<LineSymbolizer'
					+ attrs(symb, ['type'])
					+ ' />';
				break;
			case 'poly':
				return '<PolygonSymbolizer'
					+ attrs(symb, ['type'])
					+ ' />';
				break;
			case 'text':
				return '<TextSymbolizer'
					+ attrs(symb, ['type', 'content'])
					+ '><![CDATA[' + symb.content + ']]></TextSymbolizer>';
				break;
		}
		return '';
	};

	var ruleToXML = function (rule) {
		var s = '<Rule>';
		rule.options = rule.options || {};
		if (rule.options.maxzoom)
			s += '<MaxScaleDenominator>' + zoomsStart[rule.options.maxzoom.toString()] + '</MaxScaleDenominator>';
		if (rule.options.minzoom)
			s += '<MinScaleDenominator>' + zoomsEnds[rule.options.minzoom.toString()] + '</MinScaleDenominator>';
		if (rule.options.filter)
			s += '<Filter>' + rule.options.filter + '</Filter>';
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
			p += '<Parameter' + attr('name', key) + '>' + mapdef.options[key] + '</Parameter>';
		} else {
			s += attr(key, mapdef.options[key]);
		}
	}
	s += '>';
	if (p.length)
		s += '<Parameters>' + p + '</Parameters>';

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
				la += '<Parameter name="' + key + '"><![CDATA[' + src[key] + ']]></Parameter>';
			}
			la += '</Datasource>';
		}
	}
	s += la + '</Map>';
	return s;
};

MapnikDefs.xmljs2json = function (xmljson) {

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
//				rule.options.max_zoom =
				//TODO
			} else if (key == "MinScaleDenominator") {
				var val = xmlrule[key][0];
//				rule.options.min_zoom =
				//TODO
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