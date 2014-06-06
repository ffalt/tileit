# TileIt

A node.js [slippy maps](http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames) tile server

Tiles Sources:
* `file` just a bunch of files in folders; format "/path_to_in_config/[mapname]/[z]/[x]/[y].[ext]"
* `metafile` read and serve tiles from a directory of files in metatiles-format
* `memcached`: serve files from memory
* `tirex` request & deliver tiles from tirex metatiles renderer (derived from [osm tileserver](http://svn.openstreetmap.org/applications/utils/tirex/tileserver/))
* `tiles` A mirroring map tile proxy (derived from [tilethief](https://github.com/yetzt/tilethief.git))
* `wms` A mirroring map tile proxy for [wms-server](http://en.wikipedia.org/wiki/Web_Map_Service)
* `mapnik` Render tiles with [mapnik](https://github.com/mapnik) (derived from [tilelive-mapnik](https://github.com/mapbox/tilelive-mapnik))

## Setup

run `npm install` to install the required nodejs-packages

please note: you need to install extra packages for plugins if you want to use them

mapnik plugin: `npm install mapnik`

tirex plugin:	`npm install unix-dgram`

memcached plugin:  `npm install memcached`


## Configuration

[Documentation](https://github.com/ffalt/tileit/wiki)


## TODO

* general: max-age strategy?
* memcached: expiration strategy?
* tests

