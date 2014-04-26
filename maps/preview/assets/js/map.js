$(document).ready(function () {
	$('#head').hide();

	var map = new L.Map('map');
	map.on('dblclick', function (e) {
		console.log(e);
		alert("You dblclick the map at " + e.latlng + ' point: ' + e.containerPoint + ' zoom: ' + map.getZoom());
	});

	var initMaps = function (overlayLayers) {
//	map.options.crs = L.CRS.EPSG3395;
		var baseLayers = {};
		var layercontrols = L.control.orderlayers(
			baseLayers, overlayLayers,
			{
				collapsed: false,
				title: 'Maps'
			}
		);
		layercontrols.addTo(map);

		L.control.mousePosition({
			lngFormatter: function (lng) {
				return 'Lng: ' + lng;
			},
			latFormatter: function (lat) {
				return ' Lat: ' + lat;
			},
			zoomFormatter: function (z) {
				return 'Zoom: ' + z
			}
		}).addTo(map);


		var locationFilter = new L.LocationFilter({ enableButton: {
			enableText: '<img src="assets/images/resize-handle.png">',
			disableText: "Remove selection"
		}
		}).addTo(map);

		var info = L.control({position: 'bottomleft'});
		info.enabled = false;
		info.onAdd = function (map) {
			this._div = L.DomUtil.create('div', 'info');
			this.update();
			return this._div;
		};
		info.update = function (props) {
			// method that we will use to update the control based on feature properties passed
		};
		info.setText = function (txt) {
			this._div.innerHTML = txt;
		};
		info.setBoundsText = function (bounds) {
			if (bounds.getNorthEast())
				this.setText(
						'Selected - ' + ' ' +
						'North: ' + L.Util.formatNum(bounds.getNorthEast().lat, 5) + ' ' +
						'South: ' + L.Util.formatNum(bounds.getSouthWest().lat, 5) + ' ' +
						'West: ' + L.Util.formatNum(bounds.getSouthWest().lng, 5) + ' ' +
						'East: ' + L.Util.formatNum(bounds.getNorthEast().lng, 5)
				);

			//			- `bbox` {Number} bbox in the form `[w, s, e, n]`.
			$('#head').text('it -m '+layercontrols._activemaps() +' -z ' + map.getZoom() + ' -b ' +
					L.Util.formatNum(bounds.getSouthWest().lng, 2)+','+
					L.Util.formatNum(bounds.getSouthWest().lat, 2)+','+
					L.Util.formatNum(bounds.getNorthEast().lng, 2)+','+
					L.Util.formatNum(bounds.getNorthEast().lat, 2)
			);
		};
		info.setBaseBoundsText = function () {
			this.setText('');
		};

		info.addTo(map);
		map.on('zoomend', function () {
			if (info.enabled)
				info.setBoundsText(locationFilter.getBounds());
		}, this);

		info.setBaseBoundsText();

		locationFilter.on("change", function (e) {
			info.setBoundsText(e.bounds);
		});

		locationFilter.on("enabled", function () {
			info.enabled = true;
			$('#head').show();
			info.setBoundsText(locationFilter.getBounds());
		});

		locationFilter.on("disabled", function () {
			info.enabled = false;
			$('#head').hide();
			info.setBaseBoundsText();
		});

		map.setView([50, 20], 3);
	};

	$.getJSON("/_preview/maps.json", function (data) {
		var
			image_formats = ['png', 'jpeg', 'svg', 'utf'];
		var overlayLayers = {};
		$.each(data.maps, function (key, val) {
			if (image_formats.indexOf(val.format) >= 0) {
				var layer = new L.TileLayer(data.prefixpath + '/' + val.name + '/{z}/{x}/{y}.' + val.format, {
					attribution: val.attribution,
					minZoom: val.minz,
					maxZoom: val.maxz
				});
				overlayLayers[val.desc || val.name] = layer;
			} else if (val.format == 'utf') {
				var utfGrid = new L.UtfGrid(data.prefixpath + '/' + val.name + '/{z}/{x}/{y}.' + val.format, {
					resolution: 2
				});
				overlayLayers[val.desc || val.name] = utfGrid;
			}
		});
		initMaps(overlayLayers);
	});
});
