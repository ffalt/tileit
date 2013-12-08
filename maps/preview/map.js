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

	$.getJSON("/preview/maps.json", function (data) {
		var
			image_formats = ['png', 'jpeg'];
		var overlayLayers = {};
		$.each(data, function (key, val) {
			if (image_formats.indexOf(val.format) >= 0) {
				var layer = new L.TileLayer('/tiles/' + val.name + '/{z}/{x}/{y}.' + val.format, {
					attribution: val.attribution,
					minZoom: val.minz,
					maxZoom: val.maxz
				});
				overlayLayers[val.desc || val.name] = layer;
			} else if (val.format == 'utf') {
				var utfGrid = new L.UtfGrid('/tiles/' + val.name + '/{z}/{x}/{y}.' + val.format, {
					resolution: 2
				});
				overlayLayers[val.desc || val.name] = utfGrid;
			}
		});
		initMaps(overlayLayers);
	});
});
