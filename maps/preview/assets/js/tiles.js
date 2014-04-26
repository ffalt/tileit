var maps = {};
var grid, map;
var current = {
	map: null,
	z: 0,
	x: 0,
	y: 0,
	minz: 0,
	maxz: 18
};

var checkCurrent = function (x, y, z) {
	if (!current.map) {
		$('#infobar').text('Choose a map');
		return;
	}
	if (z < current.minz) {
		$('#infobar').text('Zoom Level Minimum ' + current.minz);
		return;
	}
	if (z > current.maxz) {
		$('#infobar').text('Zoom Level Maximum ' + current.maxz);
		return;
	}
	var limit = Math.pow(2, z) - 1;
	if (x < 0) {
		$('#infobar').text('x Minimum 0');
		return;
	}
	if (x > limit) {
		$('#infobar').text('x Maximum ' + limit);
		return;
	}
	if (y < 0) {
		$('#infobar').text('y Minimum 0');
		return;
	}
	if (y > limit) {
		$('#infobar').text('y Maximum ' + limit);
		return;
	}
	var key = [current.map.name, z, x, y].join('/') + '.' + current.map.format;
	$('#infobar').text(key);
	return true;
};

var doGrid = function (interval) {
//	if (grid)
//		map.removeLayer(grid);
//	grid = L.graticule({
//		style: {
//			color: '#777',
//			weight: 1,
//			opacity: 0.5
//		},
//		grid: true,
//		interval: interval
//	}).addTo(map);
};

var processCurrent = function () {
	if (checkCurrent(current.x, current.y, current.z)) {
		var key = [current.map.name, current.z, current.x, current.y].join('/') + '.' + current.map.format;
		if (current.map.format == 'pdf') {
			$('#content').html(
				'<embed src="/tiles/' + key + '" type="application/pdf">'
			);
		} else {
			$('#content').html(
				'<img src="/tiles/' + key + '">'
			);
		}
	}
};

$(document).ready(function () {

	$.getJSON("/preview/maps.json", function (data) {
		maps = data;
		processCurrent();
		$.each(data, function (key, val) {
			$('#maplist').append('<li>' + key + '</li>');
		});
		$('#maplist li').click(function () {
			var mapname = $(this).text();
			current.map = maps[mapname];
			current.minz = current.map.minz || 0;
			current.maxz = current.map.maxz || 18;
			$('#maplist li').removeClass('active');
			$(this).addClass('active');
			processCurrent();
			return false;
		});
	});


	var processInput = function (input, func_change, func_end) {
		input.keyup(function (e) {
			if (e.keyCode == 13)
				func_end(parseInt(input.val()) || 0);
			else
				func_change(parseInt(input.val()) || 0);
		});
		input.keydown(function (event) {
			// Allow: backspace, delete, tab, escape, enter and .
			if ($.inArray(event.keyCode, [46, 8, 9, 27, 13, 190]) !== -1 ||
				// Allow: Ctrl+A
				(event.keyCode == 65 && event.ctrlKey === true) ||
				// Allow: home, end, left, right
				(event.keyCode >= 35 && event.keyCode <= 39)) {
				// let it happen, don't do anything
				return;
			}
			else {
				// Ensure that it is a number and stop the keypress
				if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105 )) {
					event.preventDefault();
				}
			}
		});
	};

	map = new L.Map('map');
	map.on('zoomend', function (e) {
		current.z = map.getZoom();
		$("#num_z").val(current.z);
	});
//	doGrid(180);
	map.setView([0, 0], 0);
	map.on('click', function (e) {
		var x = (Math.floor((e.latlng.lng + 180) / 360 * Math.pow(2, map.getZoom())));
		$("#num_x").val(x);
		current.x = x;
		var y = (Math.floor((1 - Math.log(Math.tan(e.latlng.lat * Math.PI / 180) + 1 / Math.cos(e.latlng.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, map.getZoom())));
		$("#num_y").val(y);
		current.y = y;
		processCurrent();
	});
	var funcLayer = new L.TileLayer.Functional(function (view) {
			return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAAD2e2DtAAAACXBIWXMAAAsTAAALEwEAmpwYAAABCmlDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjardA9SgNBAMXx/0TURtQiWE+phQvGasvNh4tgms0W2XSb2SFZkt0dZsaY3MFDeASP4A1SCF5EsLYIEiwFf9XjNQ8eiNeo3x20zqGqvY2TKBtnE3m85YgDAMiVM8PRXQpQN7XmNwFfHwiA9+uo3x3wN4fKWA+8AQ+FdgrECVA+eeNBrIH2dGE8iGegvUiTHogX4NTrtQfoNWZjy9ncy0t1JW/CMJRR0Uy1HG2c15WT97VqrGls7nURyGi5lEk5m3snE+20XekiYLcNwFls842M86rKZSfo8O/G2UTu0meKAMTFdt/tqUe7+vm5dQvfvwZAKuJ5dkAAAAAgY0hSTQAAeiUAAICDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAAAehJREFUeNrs1bENgDAMRUEnGGX/aWkIoYpExwC+q1x/PcktVlBYN4EAKCz3cV15mqOSZ47xCSAz0yilAmheAAIQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAIQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAAJAAAgAASAABIAAEAACQAAIAAEgAASAABAAAkAACAABIAAEgAAQAALgX+7jnl0MpdwzjogWyxReAGW9AAAA//8DAA8UDQs54dXFAAAAAElFTkSuQmCC';

//		var url = 'http://otile{3}.mqcdn.com/tiles/1.0.0/map/{0}/{1}/{2}.jpg'
//			.replace('{0}', view.zoom)
//			.replace('{1}', view.tile.row)
//			.replace('{2}', view.tile.column)
//			.replace('{3}', view.subdomain);
//		return url;

	}, {
		noWrap: true
	}).addTo(map);
	processInput($("#num_z"),
		function (val) {
			checkCurrent(current.x, current.y, val);
		},
		function (val) {
			current.z = val;
			processCurrent();
		}
	);
	processInput($("#num_y"),
		function (val) {
			checkCurrent(current.x, val, current.z);
		},
		function (val) {
			current.y = val;
			processCurrent();
		});
	processInput($("#num_x"),
		function (val) {
			checkCurrent(val, current.y, current.z);
		},
		function (val) {
			current.x = val;
			processCurrent();
		});

});
