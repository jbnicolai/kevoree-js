var Resolver      = require('kevoree-commons').Resolver,
    KevoreeLogger = require('kevoree-commons').KevoreeLogger,
    kevoree       = require('kevoree-library').org.kevoree,
    npm           = require('npm'),
    npmi          = require('npmi'),
    fs            = require('fs'),
    rimraf        = require('rimraf'),
    async         = require('async'),
    path          = require('path');

var NPMResolver = Resolver.extend({
    toString: 'NPMResolver',

    construct: function () {
        this.log.debug(this.toString(), 'modulesPath= '+this.modulesPath);
    },

    resolve: function (deployUnit, forceInstall, callback) {
        if (!callback) {
            // "forceInstall" parameter is not specified (optional)
            callback = forceInstall;
            forceInstall = false;
        }

        var loader  = new kevoree.loader.JSONModelLoader(),
            pkgPath = path.resolve(this.modulesPath, 'node_modules', deployUnit.name), // default npm module location
            options = {
                name:           deployUnit.name,
                version:        deployUnit.version,
                forceInstall:   forceInstall,
                path:           this.modulesPath
            };

        var npmiCallback = function (err) {
            if (err) {
                this.log.error(this.toString(), err.message);
                return callback(new Error("Bootstrap failure"));
            }

            // resolve deployUnit module (require it) and call callback
            var KClass = require(pkgPath);
            var jsonModel = require(path.resolve(pkgPath, 'kevlib.json'));
            try {
                var model = loader.loadModelFromString(JSON.stringify(jsonModel)).get(0);
                return callback(null, KClass, model);
            } catch (err) {
                // something went wrong while loading model :/
                return callback(err);
            }
        }.bind(this);

        // lets try to check if the current directory contains the library
        // so that we can install it with the local content
        fs.readFile(path.resolve('.', 'package.json'), function (err, pkgRawData) {
            if (err) {
                // unable to require current directory package.json, lets try to resolve module from npm registry
                return npmi(options, npmiCallback);
            }

            var pkg = JSON.parse(pkgRawData);
            if (pkg.name === deployUnit.name) {
                // current directory contains the library we want to resolve
                options = {
                    name:           path.resolve('.'),  // local path
                    localInstall:   true,               // local library => local install
                    path:           this.modulesPath,
                    forceInstall:   true                // always reinstall local library (to keep them up-to-date)
                };
                npmi(options, npmiCallback);
            } else {
                // well unable to find module locally, lets try to resolve it from npm registry
                npmi(options, npmiCallback);
            }
        }.bind(this));
    },

    uninstall: function (deployUnit, callback) {
        npm.load({loglevel: 'silent', prefix: this.modulesPath}, function (err) {
            if (err) {
                // npm load error
                return callback(new Error('NPMResolver error: unable to load npm module'));
            }

            // load success
            npm.commands.uninstall([deployUnit.name], function (er) {
                if (er) {
                    // failed to load package:version
                    callback(new Error('NPMResolver failed to uninstall '+module));
                    return;
                }

                callback();

            }.bind(this));
        }.bind(this));
    }
});

module.exports = NPMResolver;