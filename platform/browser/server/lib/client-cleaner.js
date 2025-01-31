var config    = require('../config'),
    WSServer  = require('ws').Server,
    rimraf    = require('rimraf'),
    path      = require('path');

var noop = function () {};

var REGISTER = 'register',
    SETNAME  = 'setname';

/**
 * Created by leiko on 17/04/14.
 */
function ClientCleaner(server, model, knjs) {
    this.model = model;
    var wss = new WSServer({server: server, path: '/cc'});
    var clients = {};

    wss.on('connection', function (ws) {
        clients[ws.upgradeReq.headers['sec-websocket-key']] = {};

        ws.on('message', function (msg) {
            try {
                var client = clients[ws.upgradeReq.headers['sec-websocket-key']];
                msg = JSON.parse(msg);
                switch (msg.action) {
                    case REGISTER:
                        client.uuid = msg.uuid;
                        client.name = msg.name;
                        break;

                    case SETNAME:
                        if (client.uuid) {
                            client.name = msg.name;
                        } else {
                            console.log('Cannot setname on unregistered client (setname='+msg.name+')');
                        }
                        break;
                }
            } catch (err) {
                console.log('Unable to process received message (in client-cleaner), message discarded.');
            }
        }.bind(this));

        ws.on('close', function () {
            var client = clients[ws.upgradeReq.headers['sec-websocket-key']];
            if (client.name) {
                // if clients[ws.upgradeReq.headers['sec-websocket-key']].name is set, it means that the platform has been started
                // so it has probably download some modules server-side => clean those
                rimraf(path.resolve(config.paths.npmInstallDir(client.uuid), '..'), noop);
                // and also clean model from removed node platform
                var node = this.model.findNodesByID(client.name); // TODO what about name changes at runtime ?
                if (node) {
                    // delete node
                    var bindings, binding;
                    // delete bindings related to this node
                    var comps = node.components.iterator();
                    while (comps.hasNext()) {
                        var comp = comps.next();
                        var provided = comp.provided.iterator();
                        while (provided.hasNext()) {
                            var pPort = provided.next();
                            bindings = pPort.bindings.iterator();
                            while (bindings.hasNext()) {
                                binding = bindings.next();
                                binding.hub.removeBindings(binding);
                                this.model.removeMBindings(binding);
                            }
                        }
                        var required = comp.required.iterator();
                        while (required.hasNext()) {
                            var rPort = required.next();
                            bindings = rPort.bindings.iterator();
                            while (bindings.hasNext()) {
                                binding = bindings.next();
                                binding.hub.removeBindings(binding);
                                this.model.removeMBindings(binding);
                            }
                        }
                    }

                    // delete links with groups
                    var groups = node.groups.iterator();
                    while (groups.hasNext()) {
                        var grp = groups.next();
                        grp.removeSubNodes(node);
                    }

                    // delete channels fragment dictionaries related to this node
                    var chans = this.model.hubs.iterator();
                    while (chans.hasNext()) {
                        var chan = chans.next();
                        var dic = chan.findFragmentDictionaryByID(node.name);
                        if (dic) {
                            chan.removeFragmentDictionary(dic);
                        }
                    }

                    this.model.removeNodes(node);

                    // deploy cleaned model
                    knjs.deploy(this.model);
                    console.log('Client "'+client.name+'" disconnected. Removed from model.');
                }
            }

            delete clients[ws.upgradeReq.headers['sec-websocket-key']];
        }.bind(this));
    }.bind(this));
}

ClientCleaner.prototype.setModel = function (model) {
    this.model = model;
};


module.exports = ClientCleaner;