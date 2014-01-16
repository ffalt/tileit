var
	path = require("path"),
	fs = require("fs"),
	mapnikdefs = require('../lib/utils/mapnikdef.js').MapnikDefs;

var program = require('commander');
program
	.version('0.0.1')
	.usage('\n   convert xml to json: [options] <sourcefile.xml> <destfile.json>\n   or\n   convert json to xml: [options] <sourcefile.json> <destfile.xml>')
	.option('-f, --force', 'overwrite destination file if exists')
	.parse(process.argv);

if (program.args.length != 2) {
	console.error('Invalid Parameter Count, required 2 (<sourcefile ...> <destfile ...>)');
	process.exit(1);
}

var src = program.args[0];
if (!fs.existsSync(src)) {
	console.error('Source file not found:', src);
	process.exit(1);
}
var srcext = path.extname(src).toLowerCase();
if (['.json', '.xml'].indexOf(srcext) < 0) {
	console.error('Invalid File-Extension:', src);
	process.exit(1);
}
var dest = program.args[1];
if ((!program.force) && fs.existsSync(dest)) {
	console.error('Destination file exists:', dest);
	process.exit(1);
}
var destext = path.extname(dest).toLowerCase();
if (['.json', '.xml'].indexOf(destext) < 0) {
	console.error('Invalid File-Extension:', src);
	process.exit(1);
}

function readXML(data, cb) {
	try {
		var xml2js = require('xml2js');
	} catch (e) {

	}
	if (!xml2js) {
		console.error('package xml2js not loaded, try (re-)installing with: npm install xml2js', src);
		process.exit(1);
	}
	var parser = new xml2js.Parser();
	parser.parseString(data, function (err, result) {
		var mapjson = mapnikdefs.xmljs2json(result);
		cb(mapjson);
	});
}

function write(mapjson) {
	var s = '';
	if (destext === '.xml') {
		s = mapnikdefs.toXML(mapjson, true);
	} else if (destext === '.json') {
		s = JSON.stringify(mapjson);
	}
	fs.writeFileSync(dest, s);
	console.log('Done');
}

fs.readFile(src, function (err, data) {
	if (err) {
		console.error(err, src);
		process.exit(1);
	}
	if (srcext === '.xml') {
		readXML(data, function (mapjson) {
			write(mapjson);
		});
	} else if (srcext === '.json') {
		var mapjson = JSON.parse(data);
		write(mapjson);
	}
});