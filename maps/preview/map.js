$(document).ready(function () {
	var map = new L.Map('map');
	map.on('dblclick', function (e) {
		console.log(e);
		alert("You dblclick the map at " + e.latlng + ' point: ' + e.containerPoint + ' zoom: ' + map.getZoom());
	});

	var initMaps = function (overlayLayers) {
//	map.options.crs = L.CRS.EPSG3395;
		var baseLayers = {};
		var controls = L.control.orderlayers(
			baseLayers, overlayLayers,
			{
				collapsed: false,
				title: 'Maps'
			}
		);
		controls.addTo(map);
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
