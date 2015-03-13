if (typeof(Number.prototype.toRad) === "undefined") {
	Number.prototype.toRad = function () {
		return this * Math.PI / 180;
	}
}

var app = angular.module("mapapp", ["leaflet-directive", 'ui.bootstrap', 'zeroclipboard']);

app.config(['uiZeroclipConfigProvider', function (uiZeroclipConfigProvider) {
	uiZeroclipConfigProvider.setZcConf({
		swfPath: 'assets/bower_components/zeroclipboard/dist/ZeroClipboard.swf'
	});
}]);

app.controller('ModalTileController', function ($scope, $modalInstance, tile) {

	$scope.tile = tile;
	$scope.getSrc = function (name, layer) {
		return layer.url
			.replace('{z}', tile.z)
			.replace('{x}', tile.x)
			.replace('{y}', tile.y);
	};

	$scope.ok = function () {
		$modalInstance.close(true);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
});

app.controller('MapController', function ($scope, $http, $modal, $timeout, leafletData) {

	var AreaSelectControl = L.control();
	AreaSelectControl.setPosition('topleft');
	AreaSelectControl.onAdd = function (map) {
		var container = L.DomUtil.create('div', 'leaflet-control-select leaflet-bar');
		var link = L.DomUtil.create('a', '', container);
		link.href = '#';
		link.title = 'Select Area';
		var areaSelect = false;
		L.DomUtil.create('i', 'fa fa-square-o', link);
		L.DomEvent
			.on(link, 'click', L.DomEvent.stopPropagation)
			.on(link, 'mousedown', L.DomEvent.stopPropagation)
			.on(link, 'dblclick', L.DomEvent.stopPropagation)
			.on(link, 'click', L.DomEvent.preventDefault)
			.on(link, 'click', function (event, b) {
				if (areaSelect) {
					areaSelect.remove();
					areaSelect = false;
					$scope.selection.bounds = null;
				}
				else {
					areaSelect = L.areaSelect({width: 200, height: 200});
					areaSelect.on("change", function () {
						$scope.selection.bounds = this.getBounds();
					});
					areaSelect.addTo(map);
				}
			});
		return container;
	};

	$scope.leaflet = {
		center: {
			lat: 50,
			lng: 20,
			zoom: 3
		},
		layers: {
			baselayers: {}
		},
		events: {
			map: {
				enable: ['click', 'mousemove', 'dblclick'],
				logic: 'emit'
			}
		},
		controls: {
			custom: [AreaSelectControl]
		}
	};
	$scope.selection = {};
	$scope.data = {};
	$scope.maps = [];

	$scope.selectMap = function (m) {
		m.active = true;
		var layer = {
			name: m.name,
			type: 'xyz',
			url: $scope.data.prefixpath + '/' + m.name + '/{z}/{x}/{y}.' + m.format,
			def: m
		};
		$scope.leaflet.layers.baselayers[m.name] = layer;
		$scope.selection.layer = layer;
		$timeout(function () {
			angular.forEach($scope.leaflet.layers.baselayers, function (val, key) {
				if (val.def !== m) {
					delete $scope.leaflet.layers.baselayers[val.name];
					val.def.active = false;
				}
			});
		}, 400);
	};

	$http.get('/_preview/maps.json').
		success(function (data, status, headers, config) {
			$scope.data = data;
			var maps = [];
			var maph = {};
			$.each(data.maps, function (key, val) {
				var c = val.category || 'Unsorted';
				var cat = maph[c];
				if (!cat) {
					cat = {name: c, maps: []};
					maph[cat.name] = cat;
					maps.push(cat);
				}
				cat.maps.push(val);
			});
			$scope.maps = maps;
			leafletData.getMap().then(function (map) {
				$scope.selection.map = map;
			});
		}).
		error(function (data, status, headers, config) {
		});

	function getTile(lat, lon, zoom) {
		var xtile = parseInt(Math.floor((lon + 180) / 360 * (1 << zoom)));
		var ytile = parseInt(Math.floor((1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1 << zoom)));
		return {z: zoom, x: xtile, y: ytile};
	}

	$scope.displayTile = function (tile) {
		tile.layers = $scope.leaflet.layers.baselayers;
		var modalInstance = $modal.open({
			templateUrl: 'partials/modal-tile.html',
			controller: 'ModalTileController',
			size: 'lg',
			resolve: {
				tile: function () {
					return tile;
				}
			}
		});
		modalInstance.result.then(function (ok) {
			//console.log('onclose');
		}, function () {
			//console.log('closed');
		});
	};

	$scope.$on('leafletDirectiveMap.click', function (event, b) {
		if ($scope.selection.bounds) return; //is in selection mode
		var e = b.leafletEvent;
		var tile = getTile(e.latlng.lat, e.latlng.lng, e.target.getZoom());
		$scope.displayTile(tile);
	});

	$scope.$on('leafletDirectiveMap.mousemove', function (event, b) {
		var e = b.leafletEvent;
		$scope.selection.current_latlng = e.latlng;
		$scope.selection.current_tile = getTile(e.latlng.lat, e.latlng.lng, e.target.getZoom());
	});

	//$scope.$on('leafletDirectiveMap.dblclick', function (event) {
	//	console.log('dblclick', event);
	//});

});

app.directive('resizer', function ($document) {

	return function ($scope, $element, $attrs) {

		$element.on('mousedown', function (event) {
			event.preventDefault();

			$document.on('mousemove', mousemove);
			$document.on('mouseup', mouseup);
		});

		function mousemove(event) {

			if ($attrs.resizer == 'vertical') {
				// Handle vertical resizer
				var x = event.pageX;

				if ($attrs.resizerMax && x > $attrs.resizerMax) {
					x = parseInt($attrs.resizerMax);
				}

				$element.css({
					left: x + 'px'
				});

				$($attrs.resizerLeft).css({
					width: x + 'px'
				});
				$($attrs.resizerRight).css({
					left: (x + parseInt($attrs.resizerWidth)) + 'px'
				});

			} else {
				// Handle horizontal resizer
				var y = window.innerHeight - event.pageY;

				$element.css({
					bottom: y + 'px'
				});

				$($attrs.resizerTop).css({
					bottom: (y + parseInt($attrs.resizerHeight)) + 'px'
				});
				$($attrs.resizerBottom).css({
					height: y + 'px'
				});
			}
		}

		function mouseup() {
			$document.unbind('mousemove', mousemove);
			$document.unbind('mouseup', mouseup);
		}
	};
});
