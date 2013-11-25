# TileIt

a node.js <a href="http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames">slippy</a> maps tile server


Tiles Sources:
  - file: just a bunch of file in folders; format "/path_to_in_config/[mapname]/[z]/[x]/[y].[ext]"
  - memcached: serve files from memory
  - tirex: request & deliver tiles from tirex metatiles renderer derived from <a href="http://svn.openstreetmap.org/applications/utils/tirex/tileserver/">osm tileserver</a>
  - tilethief: A mirroring map tile proxy derived from <a href="https://github.com/yetzt/tilethief.git">tilethief</a>
  - wms: A mirroring map tile proxy for wms-server


## Configuration

rename `config.js.dist` to `config.js` and edit the settings with your favorite editor


## TODO

general: max-age strategy?

memcached: expiration strategy?

wms: testing

