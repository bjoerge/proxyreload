var fs = require("fs");
var difference = require('lodash.difference');
var path = require('path');
var Promise = require('bluebird');

var stat = Promise.promisify(fs.stat);

function one(method) {
  var current = null;
  return function () {
    current = current || method.apply(this, arguments);
    current.finally(function () {
      current = null;
    });
    return current;
  }
}

module.exports = ModuleStats;

function ModuleStats(options) {
  options = options || {};

  options.throttle = 'throttle' in options ? options.throttle : 0;

  this.options = options;

  this._prevCheck = 0;

  // A map of module => lastModifiedTime 
  this.mtimes = {};
  this.knownModules = [];
}

ModuleStats.prototype.update = function update(modules) {
  var added = difference(modules, this.knownModules);
  this.knownModules.push.apply(this.knownModules, added);
  return Promise.map(added, this._setMTimes.bind(this));
};

ModuleStats.prototype._setMTimes = function _checkModule(module) {
  var mtimes = this.mtimes;
  if (module in mtimes) {
    // Only set modified time on new modules
    return;
  }

  // Module not previously known to us, add it as known and return false for no need to reload
  return stat(module).then(function (stat) {
    mtimes[module] = stat.mtime;
  });
};

ModuleStats.prototype._checkModule = function _checkModule(module) {

  var mtimes = this.mtimes;
  return stat(module).then(function (stat) {
    return stat.mtime.getTime() > mtimes[module].getTime();
  });
};

ModuleStats.prototype.check = function check() {
  var now = new Date().getTime();
  var sincePrevCheck = now - this._prevCheck;
  if (this.options.throttle && sincePrevCheck < this.options.throttle) {
    return Promise.resolve([]);
  }
  this._prevCheck = now;
  return Promise.filter(this.knownModules, this._checkModule.bind(this))
};