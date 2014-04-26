L.Control.MousePosition = L.Control.extend({
	options: {
		position: 'bottomleft',
		separator: ' - ',
		emptyString: '',
		lngFirst: false,
		numDigits: 5,
		lngFormatter: undefined,
		latFormatter: undefined,
		zoomFormatter: undefined
	},

	onAdd: function (map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
		L.DomEvent.disableClickPropagation(this._container);
		this.lastzoom = map.getZoom();
		map.on('mousemove', this._onMouseMove, this);
		map.on('zoomend', this._onZoomEnd, this);
		this._container.innerHTML = this.options.emptyString;
		return this._container;
	},

	onRemove: function (map) {
		map.off('mousemove', this._onMouseMove);
		map.off('zoomend', this._onZoomEnd);
	},

	_onZoomEnd: function (e) {
		this.lastzoom = e.target.getZoom();
	},

	_onMouseMove: function (e) {
		var lng = L.Util.formatNum(e.latlng.lng, this.options.numDigits);
		var lat = L.Util.formatNum(e.latlng.lat, this.options.numDigits);
		var z = this.lastzoom || 0;
		if (this.options.zoomFormatter) z = this.options.zoomFormatter(z);
		if (this.options.lngFormatter) lng = this.options.lngFormatter(lng);
		if (this.options.latFormatter) lat = this.options.latFormatter(lat);
		var value = z + this.options.separator + (this.options.lngFirst ? lng + this.options.separator + lat : lat + this.options.separator + lng);
		this._container.innerHTML = value;
	}

});
L.Map.mergeOptions({
	positionControl: false
});

L.Map.addInitHook(function () {
	if (this.options.positionControl) {
		this.positionControl = new L.Control.MousePosition();
		this.addControl(this.positionControl);
	}
});

L.control.mousePosition = function (options) {
	return new L.Control.MousePosition(options);
};
