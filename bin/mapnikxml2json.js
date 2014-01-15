var
	fs = require("fs")
	, path = require("path")
	, async = require("async")
	, xml2js = require('xml2js')
	, xmljs2json = require('../lib/utils/mapnikdef.js').MapnikDefs.xmljs2json
	;

var program = require('commander');
program
	.version('0.0.1')
	.usage('<sourcefile ...> <destfile ...>')
//	.option('-m, --map [names]', 'comma-separated list of maps | e.g. demomap1,demomap2')
//	.option('-z, --zoom [levels]', 'comma-separated min/max zoom | e.g. 5 or 5,10, if you need a range use two points 1..5')
//	.option('-b, --bbox [coords]', 'comma-separated bounding box | e.g. nw-lat,nw-lng,se-lat,se-lng ')
//	.option('-c, --cmd [mode]', '"s": don\' do anything, just print out tile list, "w" warm cache, "d" show disk usage')
	.parse(process.argv);

console.log(program.args);
if (program.args.length != 2) {
	console.error('Invalid Parameter Count, required 2 (<sourcefile ...> <destfile ...>)');
	process.exit(1);
}

var src = program.args[0];
if (!fs.existsSync(src)) {
	console.error('Source file not found:', src);
	process.exit(1);
}

var dest = program.args[1];
if (fs.existsSync(dest)) {
	console.error('Destination file exists:', dest);
	process.exit(1);
}


var parser = new xml2js.Parser();
fs.readFile(src, function (err, data) {
	parser.parseString(data, function (err, result) {
		var mapjson = xmljs2json(result);
		fs.writeFileSync(dest, JSON.stringify(mapjson));
		console.log('Done');
	});
});