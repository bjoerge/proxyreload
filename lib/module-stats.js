var fs = require("fs");
var difference = require('lodash.difference');
var Promise = require('bluebird');

var stat = Promise.promisify(fs.stat);
var log = require("./log");

/**
Turns a promise-returning function into a semaphore function that can only be called one at a time
If it is called again before the previous operation is finished, the promise from the previous operation is returned
instead
*/
function semaphorize(method) {
  var current = null;
  return function () {
    if (current) {
      return current;
    }
    current = method.apply(this, arguments);
    current.finally(function () {
      current = null;
    });
    return current;
  }
}

module.exports = ModuleStats;

function FileNotFoundError(e) {
  return e.cause.code === 'ENOENT';
}

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

ModuleStats.prototype.remove = function remove(module) {
  var index = this.knownModules.indexOf(module);
  if (index > -1) {
    this.knownModules.splice(index, 1);
  }
  delete this.mtimes[module];
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
  })
  .catch(FileNotFoundError, function() {
    log.info("Module %s is gone, unregistering it", module);
    this.remove(module);
    return true;
  }.bind(this));
};

ModuleStats.prototype.check = semaphorize(function check() {
  var now = new Date().getTime();
  var sincePrevCheck = now - this._prevCheck;
  if (this.options.throttle && sincePrevCheck < this.options.throttle) {
    return Promise.resolve([]);
  }
  this._prevCheck = now;
  return Promise.filter(this.knownModules, this._checkModule.bind(this))
});