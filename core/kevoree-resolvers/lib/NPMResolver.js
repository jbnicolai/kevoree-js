var Resolver      = require('kevoree-commons').Resolver,
    KevoreeLogger = require('kevoree-commons').KevoreeLogger,
    kevoree       = require('kevoree-library').org.kevoree,
    npm           = require('npm'),
    npmi          = require('npmi'),
    fs            = require('fs'),
    rimraf        = require('rimraf'),
    async         = require('async'),
    path          = require('path'),
    npmVers       = require('npm-vers');

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

        var npmiLoad = function () {
            npmi(options, function (err) {
                if (err) {
                    this.log.error(this.toString(), err.message);
                    callback(new Error("Bootstrap failure"));
                    return;
                }

                // resolve deployUnit module (require it) and call callback
                var KClass = require(pkgPath);
                var jsonModel = require(path.resolve(pkgPath, 'kevlib.json'));
                try {
                    var model = loader.loadModelFromString(JSON.stringify(jsonModel)).get(0);
                    callback(null, KClass, model);
                } catch (err) {
                    // something went wrong while loading model :/
                    callback(err);
                }
            }.bind(this));
        }.bind(this);

        if (options.version === 'release') {
            npmVers(options.name, function (err, result) {
                if (err) {
                    callback(err);
                    return;
                }

                if (result.latestRelease) {
                    options.version = result.latestRelease;
                    npmiLoad();
                } else {
                    callback(new Error('No release version found for '+options.name));
                }
            }.bind(this));
        } else {
            npmiLoad();
        }
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