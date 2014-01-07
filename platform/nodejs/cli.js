var config      = require('./config.json'),
  NodeJSRuntime = require('./lib/NodeJSRuntime'),
  KevoreeLogger = require('kevoree-commons').KevoreeLogger,
  path          = require('path'),
  fs            = require('fs'),
  kevoree       = require('kevoree-library').org.kevoree,
  NPMResolver   = require('kevoree-resolvers').NPMResolver,
  FileResolver  = require('kevoree-resolvers').FileResolver,
  KevScript     = require('kevoree-kevscript'),
  argv          = require('optimist')
    .usage('Usage: $0 [--nodeName node0 --groupName sync (--model path/to/your/model.json | --kevscript path/to/your/model.kevs)]')
    .alias('n', 'nodeName')
    .alias('g', 'groupName')
    .alias('m', 'model')
    .alias('k', 'kevscript')
    .describe('nodeName', 'The name of the node platform you want to bootstrap on')
    .describe('groupName', 'The group name to which your node is gonna be connected to')
    .describe('model', 'A model to bootstrap on')
    .describe('kevscript', 'A KevScript file to bootstrap on')
    .argv;

// TODO enable install dir path in command-line
var kRuntime = new NodeJSRuntime(__dirname);
var loader   = new kevoree.loader.JSONModelLoader();
var log      = new KevoreeLogger('NodeJSRuntime');
var compare  = new kevoree.compare.DefaultModelCompare();

// Kevoree Runtime started event listener
kRuntime.on('started', function () {
  // Kevoree Core is started, deploy model
  if (argv.kevscript && argv.kevscript.length > 0) {
    // try with --kevscript param
    fs.readFile(argv.kevscript, 'utf8', function (err, text) {
      if (err) throw err;

      var options = {
        resolvers: {
          npm: new NPMResolver(__dirname, log),
          file: new FileResolver(__dirname, log)
        }
      };
      var kevs = new KevScript(options);
      kevs.parse(text, function (err, model) {
        if (err) throw err;
        kRuntime.deploy(model);
      });
    });

  } else {
    // try with --model param
    var model = loadModelFromCmdLineArg();
    kRuntime.deploy(model);
  }
});

// Kevore Runtime error event listener
kRuntime.on('error', function (err) {
  process.exit(1);
});

var loadModelFromCmdLineArg = function loadModelFromCmdLineArg() {
  if (argv.model && argv.model.length > 0) {
    var modelPath = path.resolve(argv.model);
    try {
      return loader.loadModelFromString(JSON.stringify(require(modelPath))).get(0);
    } catch (ignore) {
      log.warn('Unable to load model from \''+ argv.model+'\'');
    }
  }
}


kRuntime.start(argv.nodeName || config.nodeName, argv.groupName || config.groupName);