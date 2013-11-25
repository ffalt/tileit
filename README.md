# TileIt

a node.js slippy maps tile server


Tiles Sources:
  - file: just a bunch of file in folders; format "/path_to_in_config/[mapname]/[z]/[x]/[y].[ext]"
  - memcached: serve files from memory
  - tirex: request & deliver tiles from tirex metatiles renderer derived from http://svn.openstreetmap.org/applications/utils/tirex/tileserver/
  - tilethief: A mirroring map tile proxy derived from https://github.com/yetzt/tilethief.git
  - wms: A mirroring map tile proxy for wms-server


## Configuration

rename `config.js.dist` to `config.js` and edit the settings with your favorite editor


## TODO

general: max-age strategy?

memcached: expiration strategy?

wms: testing

