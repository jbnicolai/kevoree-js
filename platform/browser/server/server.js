var connect          = require('connect'),
    express          = require('express'),
    path             = require('path'),
    fs               = require('fs'),
    KevNodeJSRuntime = require('kevoree-nodejs-runtime'),
    routes           = require('./routes'),
    kevoree          = require('kevoree-library').org.kevoree,
    Kevscript        = require('kevoree-kevscript'),
    NPMResolver      = require('kevoree-resolvers').NPMResolver,
    config           = require('./config');

require('./lib/client-cleaner');

var compare = new kevoree.compare.DefaultModelCompare();
var factory = new kevoree.impl.DefaultKevoreeFactory();
var loader  = new kevoree.loader.JSONModelLoader();
var model   = factory.createContainerRoot();

var firstDeploy = true;

var app = express();

app.use(connect.urlencoded())
app.use(connect.json())
app.set('views', path.join(__dirname, '..', 'client', 'dist'));
app.set('port', config.port);

// rendering engine (basic html renderer)
app.engine('html', require('ejs').renderFile);

// start a kevoree nodejs platform server-side
var knjs = new KevNodeJSRuntime(config.paths.serverNodeDir);

knjs.on('started', function () {
    var kevs = new Kevscript({
        resolvers: {
            npm: new NPMResolver(config.paths.serverNodeDir, knjs.log)
        }
    });
    fs.readFile(path.resolve('server-model.kevs'), {encoding: 'utf8'}, function (err, data) {
        if (err) {
            console.error('Unable to read server-node Kevscript model file');
            console.error(err.stack);
            process.exit(1);
        }

        kevs.parse(data, function (err, model) {
            if (err) {
                console.error('Unable to parse server-node Kevscript model');
                console.error(err.stack);
                process.exit(1);
            }

            knjs.deploy(model);
        });
    });
});

knjs.on('deployed', function (deployedModel) {
    compare.merge(model, deployedModel).applyOn(model);
    if (firstDeploy) {
        firstDeploy = false;
        app.listen(app.get('port'), function () {
            console.log('Kevoree Browser Runtime Server started on port '+app.get('port'));
        });
    }
});

knjs.on('error', function (err) {
    console.log("Kevoree NodeJS Runtime ERROR:", err.message);
});

knjs.start(config.nodeJSPlatform.nodeName, config.nodeJSPlatform.groupName);

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

app.get('/', routes.main);
app.post('/bootstrap', routes.bootstrap(model));
app.post('/resolve', routes.resolve);