var Resolver        = require('kevoree-commons').Resolver,
    KevoreeLogger   = require('./BrowserLogger'),
    FileSystem      = require('kevoree-commons').FileSystem,
    async           = require('async'),
    Resolve         = require('../command/network/Resolve');

/**
 * Retrieves module content from zip from server
 * @type {NPMResolver}
 *
 * Created by leiko on 12/03/14.
 */
var NPMResolver = Resolver.extend({
    toString: 'NPMResolver',

    construct: function (modulesPath, logger, runtime) {
        this.modulesPath = modulesPath;
        this.log = logger;
        this.resolveCmd = new Resolve(runtime);
    },

    resolve: function (deployUnit, forceInstall, callback) {
        this._super(deployUnit, forceInstall, callback);
        if (typeof(callback) == 'undefined') {
            // "forceInstall" parameter is not specified (optional)
            callback = forceInstall;
            forceInstall = false;
        }

        function loadSuccess(script) {
            $.globalEval(script);
            var ModuleEntry = require(deployUnit.name);
            return callback(null, ModuleEntry);
        }

        // forward resolving request to server
        this.resolveCmd.execute(deployUnit, forceInstall, function (err, resp) {
            if (err) {
                if (err.responseText.length === 0) {
                    err.responseText = "Kevoree Runtime server was not able to process '/resolve' request ("+deployUnit.name+":"+deployUnit.version+")";
                }
                return callback(new Error(err.responseText));
            }

            // server response contains a zipPath & name of the requested module package (retrieved server-side from npm registry)
            if (window.requestFileSystem) {
                // Chrome-based browser
                installZip(resp.zipPath, resp.zipName, function (err) {
                    if (err) {
                        errorHandler(err);
                        callback(err);
                        return;
                    }

                    // zip installed successfully
                    $.ajax({
                        type: 'GET',
                        url: 'filesystem:'+window.location.origin+'/persistent/kev_libraries/'+deployUnit.name+'@'+deployUnit.version+'/'+deployUnit.name+'.js',
                        success: loadSuccess,
                        error: function (e) {
                            console.log('Unable to find filesystem:'+window.location.origin+'/persistent/kev_libraries/'+deployUnit.name+'@'+deployUnit.version+'/'+deployUnit.name+'.js');
                            callback(new Error('Unable to load \''+deployUnit.name+'@'+deployUnit.version+'\' locally :/'));
                        }
                    });
                });
            } else {
                // other browser that don't support FileSystem API
                var xhr = new XMLHttpRequest();
                xhr.open('GET', resp.zipPath, true);
                xhr.responseType = 'blob';

                xhr.onreadystatechange = function(e) {
                    if (this.readyState == 4 && this.status == 200) {
                        var reader = new FileReader();
                        reader.onload = function (e) {
                            var zip = new JSZip(e.target.result);
                            var entries = zip.file(/.+\.js/);
                            var rawScript = 'var require = require || function () {};\n' +
                                ';(function (global, window, document, $, jQuery) {\n' +
                                entries[0].data +
                                '\n' +
                                '})({WebSocket: WebSocket});';
                            loadSuccess(rawScript);
                        };
                        reader.readAsArrayBuffer(this.response);
                    }
                };

                xhr.send();
            }
        });
    },

    uninstall: function (deployUnit, callback) {
        this._super(deployUnit, callback);
        console.warn(this.toString(), "NPMResolver.uninstall(...): Not implemented yet (I did NOT uninstall the module, but I told the bootstrapper that I did)");
        // TODO remove module from Browser FileSystem
        callback();
    }
});

/**
 * Download and install zip locally in browser file system
 * @param zipPath zip file path on server
 * @param zipName zip name
 * @param callback
 */
var installZip = function installZip(zipPath, zipName, callback) {
    var fsapi = new FileSystem();
    // create a local file system of 50Mb
    fsapi.getFileSystem(5*1024*1024*1024, function (err, fs) {
        // create a root directory called "kev_libraries" in this fs
        fs.root.getDirectory('kev_libraries', { create: true, exclusive: false }, function (rootDir) {
            rootDir.getDirectory(zipName, { create: true, exclusive: false}, function (zipDir) {
                // remove dir content before re-writing
                zipDir.removeRecursively(function () {
                    // dir content removed
                    fillDir();
                }, function () {
                    // error (meaning that the directory does not exist, so create it)
                    fillDir();
                });

                /**
                 * Fill directory "zipDir" with zip content
                 */
                function fillDir() {
                    // create a new directory for the current zip
                    rootDir.getDirectory(zipName, { create: true, exclusive: false }, function (zipDir) {
                        // read zip content
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', zipPath, true);
                        xhr.responseType = 'blob';

                        xhr.onreadystatechange = function(e) {
                            if (this.readyState == 4 && this.status == 200) {
                                var reader = new FileReader();
                                reader.onload = function (e) {
                                    var zip = new JSZip(e.target.result);
                                    var entries = zip.file(/.+\.js/);
                                    for (var i in entries) {
                                        processFileEntry(entries[i], zipDir, callback);
                                    }
                                };
                                reader.readAsArrayBuffer(this.response);
                            }
                        };

                        xhr.send();

                    }, callback);
                }
            });
        }, callback);
    });
};

/**
 * Only processes 'file' entries in zip
 * @param entries
 * @param zipDir
 * @param callback
 */
var processEntries = function processEntries(entries, zipDir, callback) {
    var asyncTasks = [];

    // check entries type (dir, file)
    for (var i in entries) {
        if (entries[i].directory == false) {
            asyncTasks.push(function (taskCallback) {
                processFileEntry(entries[i], zipDir, function (err) {
                    if (err) {
                        taskCallback(err);
                        return;
                    }

                    taskCallback();
                });
            });
        }
    }

    // execute each task asynchronously
    async.parallel(asyncTasks, function (err) {
        if (err) {
            callback(err);
            return;
        }

        // all tasks run without error : cool =)
        callback();
    });
};

/**
 * Will recursively create needed directories for the file entry given
 * if its path is nested.
 * Lets say the entry has 'foo/bar/baz.ext' file path, this will try
 * to create a new directory foo, then bar, then call a file create into that 'bar' directory
 * @param entry
 * @param zipDir
 * @param callback
 */
var processFileEntry = function processFileEntry(entry, zipDir, callback) {
    getDir(entry.name, zipDir, function (dir) {
        dir.getFile(entry.name, {create: true, exclusive: false}, function(fileEntry) {
            // Create a FileWriter object for our FileEntry (log.txt).
            fileEntry.createWriter(function(fileWriter) {

                fileWriter.onwriteend = function(e) {
                    console.debug('Write completed: ', zipDir);
                    callback(null, fileEntry);
                };

                fileWriter.onerror = function(e) {
                    console.debug('Write failed: ' + e.toString());
                    callback(e);
                };

                var blob = new Blob([
                    // this is a hack to prevent dynamically loaded component to have access to globals
                    'var require = require || function () {};\n;(function (global, window, document, $, jQuery) {\n',
                    entry.asText(),
                    '\n})({WebSocket: WebSocket});'
                ], {type: 'text/plain'});
                fileWriter.write(blob);
            });

        }, callback);
    }, callback);
};

/**
 * Recursively creates directory tree according to given path
 * @param path foo/bar/baz.ext
 * @param dir root directory to start directories creation (always need a starting point !)
 * @param callback
 */
var getDir = function getDir(path, dir, callback, errorCallback) {
    if (!dir || dir == null) {
        return errorCallback(new Error('getDir(path, dir, callback, errorCallback) error: "dir" is null'));
    }

    var splittedPath = path.split('/');
    if (splittedPath.length == 1) {
        callback(dir);

    } else {
        dir.getDirectory(splittedPath[0], {create: true, exclusive: false}, function (newDir) {
            getDir(splittedPath.slice(1, splittedPath.length).join('/'), newDir, callback, errorCallback);
        }, errorHandler);
    }
};

var errorHandler = function errorHandler(e) {
    var msg = '';
    switch (e.code) {
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = 'QUOTA_EXCEEDED_ERR';
            break;
        case FileError.NOT_FOUND_ERR:
            msg = 'NOT_FOUND_ERR';
            break;
        case FileError.SECURITY_ERR:
            msg = 'SECURITY_ERR';
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = 'INVALID_MODIFICATION_ERR';
            break;
        case FileError.INVALID_STATE_ERR:
            msg = 'INVALID_STATE_ERR';
            break;
        default:
            msg = e.message;
            return;
    }

    console.log('Error: ' + msg);
};

module.exports = NPMResolver;