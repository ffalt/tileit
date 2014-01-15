//------------------------------------------------------------

function attr(name, value) {
	if (value)
		return ' ' + name + '="' + value + '"';
	return '';
}

//------------------------------------------------------------

function MapnikDefs() {

}

//------------------------------------------------------------

MapnikDefs.Style = function (options) {
	this.options = options || {};
	this.rules = [];
};

MapnikDefs.Style.prototype.addRule = function (rule) {
	this.rules.push(rule);
};

MapnikDefs.Style.prototype.newRule = function (options) {
	var rule = new MapnikDefs.Rule(options);
	this.rules.push(rule);
	return rule;
};

MapnikDefs.Style.prototype.toXML = function () {
	var s = '<Style'
		+ attr('name', this.options.name)
		+ attr('filter-mode', this.options.filtermode)
		+ '>';
	for (var i = 0; i < this.rules.length; i++)
		s += this.rules[i].toXML();
	s += '</Style>';
	return s;
};

//------------------------------------------------------------

MapnikDefs.Rule = function (options) {
	this.symbolizers = [];
	this.options = options || {};
};

MapnikDefs.Rule.prototype.addSymbolizer = function (symb) {
	this.symbolizers.push(symb);
};

MapnikDefs.Rule.prototype.newSymbolizer = function (options) {
	var symb = new MapnikDefs.Symbolizer(options);
	this.symbolizers.push(symb);
	return symb;
};

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

MapnikDefs.Rule.prototype.toXML = function () {
	var s = '<Rule>';
	if (this.options.maxzoom)
		s += '<MaxScaleDenominator>' + zoomsStart[this.options.maxzoom.toString()] + '</MaxScaleDenominator>';
	if (this.options.minzoom)
		s += '<MinScaleDenominator>' + zoomsEnds[this.options.minzoom.toString()] + '</MinScaleDenominator>';
	if (this.options.filter)
		s += '<Filter>' + this.options.filter + '</Filter>';
	for (var i = 0; i < this.symbolizers.length; i++)
		s += this.symbolizers[i].toXML();
	s += '</Rule>';
	return s;
};

//------------------------------------------------------------

MapnikDefs.Symbolizer = function (options) {
	this.options = options || {};
};

MapnikDefs.Symbolizer.prototype.toXML = function () {
	switch (this.options.type) {
		case 'line':
			return '<LineSymbolizer'
				+ attr('stroke', this.options.stroke)
				+ attr('stroke-width', this.options.strokewidth)
				+ attr('stroke-opacity', this.options.strokeopacity)
				+ ' />';
			break;
		case 'poly':
			return '<PolygonSymbolizer'
				+ attr('fill', this.options.fill)
				+ attr('fill-opacity', this.options.fillopacity)
				+ ' />';
			break;
		case 'text':
			return '<TextSymbolizer'
				+ attr('fill', this.options.fill)
				+ attr('size', this.options.size)
				+ attr('fontset-name', this.options.fontsetname)
				+ attr('placement', this.options.placement)
				+ attr('wrap-width', this.options.wrapwidth)
				+ attr('halo-fill', this.options.halofill)
				+ attr('halo-radius', this.options.haloradius)
				+ '><![CDATA[' + this.options.content + ']]></TextSymbolizer>';
			break;
	}
	return '';
};

//------------------------------------------------------------

MapnikDefs.MapnikDef = function (options) {
	this.options = options || {};
	this.styles = [];
	this.fontsets = [];
	this.layers = [];
	this.sources = [];
};

MapnikDefs.MapnikDef.prototype.addLayer = function (layer) {
	this.layers.push(layer);
};

MapnikDefs.MapnikDef.prototype.addDatasource = function (source) {
	this.sources.push(source);
};

MapnikDefs.MapnikDef.prototype.addFontSet = function (fontset) {
	this.fontsets.push(fontset);
};

MapnikDefs.MapnikDef.prototype.addStyle = function (style) {
	this.styles.push(style);
};

MapnikDefs.MapnikDef.prototype.newStyle = function (options) {
	var style = new MapnikDefs.Style(options);
	this.styles.push(style);
	return style;
};

MapnikDefs.MapnikDef.prototype.build = function (map, mapnik) {
	map.fromStringSync(this.toXML());
	var dss = {};
	for (var i = 0; i < this.sources.length; i++) {
		var src = this.sources[i];
		dss[src.name] = new mapnik.Datasource(src);
	}
	for (i = 0; i < this.layers.length; i++) {
		var layer = this.layers[i];
		var l = new mapnik.Layer(layer.name);
		l.srs = layer.srs;
		l.styles = layer.styles;
		l.datasource = dss[layer.source];
		map.add_layer(l);
	}
	map.zoomAll();
};

MapnikDefs.MapnikDef.prototype.toXML = function () {
	var s = '<Map'
		+ attr('srs', this.options.srs)
		+ attr('background-color', this.options.backgroundcolor);
	if (this.options.bounds)
		s += attr('maximum-extent', this.options.bounds.join(','));
	s += '>';
	if (this.fontsets.length) {
		for (var j = 0; j < this.fontsets.length; j++) {
			var fontset = this.fontsets[j];
			s += '<FontSet' + attr('name', fontset.name) + '>';
			for (var i = 0; i < fontset.fonts.length; i++)
				s += '<Font' + attr('face-name', fontset.fonts[i]) + ' />';
			s += '</FontSet>';
		}
	}
	for (var k = 0; k < this.styles.length; k++) {
		s += this.styles[k].toXML();
	}
	s += '</Map>';
	return s;
};

//------------------------------------------------------------

exports.MapnikDefs = MapnikDefs;