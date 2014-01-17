## TileIt

a node.js <a href="http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames">slippy</a> maps tile server


Tiles Sources:
  - file: just a bunch of file in folders; format "/path_to_in_config/[mapname]/[z]/[x]/[y].[ext]"
  - memcached: serve files from memory
  - tirex: request & deliver tiles from tirex metatiles renderer (derived from <a href="http://svn.openstreetmap.org/applications/utils/tirex/tileserver/">osm tileserver</a>)
  - tiles: A mirroring map tile proxy (derived from <a href="https://github.com/yetzt/tilethief.git">tilethief</a>)
  - wms: A mirroring map tile proxy for <a href="http://en.wikipedia.org/wiki/Web_Map_Service">wms</a>-server
  - mapnik: render tiles with <a href="https://github.com/mapnik">mapnik</a> (derived from <a href="https://github.com/mapbox/tilelive-mapnik">tilelive-mapnik</a>)

### Setup

run `npm install` to install the required nodejs-packages

please note: you need to install extra packages for plugins if you want to use them

mapnik plugin: `npm install mapnik`

tirex plugin:	`npm install unix-dgram`

memcached plugin:  `npm install memcached`


### Configuration

[Documentation](https://github.com/ffalt/tileit/wiki)


### TODO

general: max-age strategy?

memcached: expiration strategy?

tests

