# TileIt

a node.js <a href="http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames">slippy</a> maps tile server


Tiles Sources:
  - file: just a bunch of file in folders; format "/path_to_in_config/[mapname]/[z]/[x]/[y].[ext]"
  - memcached: serve files from memory
  - tirex: request & deliver tiles from tirex metatiles renderer derived from <a href="http://svn.openstreetmap.org/applications/utils/tirex/tileserver/">osm tileserver</a>
  - tilethief: A mirroring map tile proxy derived from <a href="https://github.com/yetzt/tilethief.git">tilethief</a>
  - wms: A mirroring map tile proxy for wms-server


## Configuration

### Plugin Configuration

rename `config.js.dist` to `config.js` and edit the settings with your favorite editor


```json
module.exports = {
	"hostname": "localhost",                        // host adress of the tileserver
	"port": 80,                                     // port of the tileserver
	"debug": true,                                  // display debug messages in console
	"plugs": ["memcached", "wms", "file", "tirex", "tiles"],  // enabled plugs
	"mapconfigpath": "./maps/enabled_maps",         // load map configs from this path
	"max_age": 3 * 60 * 60 * 1000,                  // max age header for http-request
	"tirex": {
		"config_dir": "./data/tirex/renderer/",       // path to Tirex config
		"master_socket": "/run/tirex/master.sock",    // path to Tirex Master Unix Datagram Socket
		"timeout": 1000                               // how long to wait for Tirex to render/response
	},
	"file": {
		 "path": "./data/xyz.ext/"      // global path for file plug (may be overwritten individually by map config)
	},
	"tiles": {
		"concurrent_requests": 10       // how many tiles can be process parallel
	},
	"wms": {
		"concurrent_requests": 10       // how many wms tiles can be process parallel
	},
	"memcached": {
		"host": "localhost",            // host adress of memcached
		"port": "11211",                // port of memcached
		"rev": "0",                     // invalidate all tiles by a version number (may be overwritten individually by map config) 
		"prefix": "tiles_",             // prefix map names (may be overwritten individually by map config)
		"expiration": 1000000,          // a tile can be replaced after ms (may be overwritten individually by map config)
		"options": {
			"timeout": 10,                // timeout of a memcached request
			"maxExpiration": 2592000      // maximal timeout of a memcached request
		}
	}
};
```

### Map Configuration

you can defy one or more maps in a json file, residing in /maps/map-enabled/ (maybe linked there from /maps/map-available) 

```json
{
	"mapname": {                    //mandatory, mapname is used in tile-url
		"minz": 0,                  //optional, default: "0"
		"maxz": 18,                 //optional, default: "18"
		"allowed_format": ["png"],  //optional, default: ["png"]
		"source": {
		    "name of plug": { map related options for the source }
		    ...see source definition below...
			  please note, sources are processed from top to bottom, so ordering of sources is important 
		}
	},
	...
}
```

Note: Maps for Tirex are loaded from the Tirex configuration path

see /maps/map-examples/ for more examples


### Source Configuration

#### file

```json
"file": {
    "path": "./some/demo/path/" //optional, if empty, global path from config.js + mapname is used otherwise
}
```

#### tiles 


```json
"tiles": {
    "url": "http://tiles.example.org/slippytilemap"  //mandatory
}
```

#### memcached

```json
"mapcached" : {
		"rev": "0",                     //optional, global rev is used otherwise (see global config above)
		"prefix": "tiles_",             //optional, global prefix is used otherwise (see global config above)
		"expiration": 1000000,          //optional, global expiration is used otherwise (see global config above) 

}
```

#### tirex

```json
"tirex" : {} 			//currently no map related options
```


## TODO

general: max-age strategy?

memcached: expiration strategy?

wms: testing

