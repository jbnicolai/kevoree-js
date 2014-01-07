var Class         = require('pseudoclass'),
    KevoreeLogger = require('kevoree-commons').KevoreeLogger,
    fs            = require('fs'),
    path          = require('path'),
    EventEmitter  = require('events').EventEmitter;

var KevoreeUI = Class({
  toString: 'KevoreeUI',

  construct: function (comp) {
    this.comp = comp;
    this.root = null;
    this.log = new KevoreeLogger(this.toString());
    this.name = null;
    this.destroyCmd = null;
    this.emitter = new EventEmitter();
  },

  isReady: function () {
    return (this.root != null);
  },

  setRoot: function (root) {
    this.root = root;
  },

  getRoot: function () {
    return this.root;
  },

  initialize: function (comp, initCmd, callback) {
    var self = this;

    if (typeof(initCmd) == 'undefined' || initCmd == null) return callback(new Error('KevoreeUI init command unset in KevoreeCore.'));

    initCmd(this, function (err) {
      if (err) {
        self.log.error(err.message);
        self.root = null;
        return callback(err);
      }

      return callback();
    });
  },

  setContent: function (content) {
    this.root.innerHTML = content;
    this.emitter.emit('contentChanged', content);
  },

  destroy: function () {
    if (this.destroyCmd) this.destroyCmd();
  },

  setDestroyCmd: function (cmd) {
    this.destroyCmd = cmd;
  },

  getName: function () {
    return this.name;
  },

  setName: function (name) {
    this.name = name;
    this.emitter.emit('nameChanged', name);
  },

  on: function (event, callback) {
    this.emitter.addListener(event, callback);
  }
});

module.exports = KevoreeUI;