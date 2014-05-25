var fs = require("fs");
var difference = require('lodash.difference');
var async = require('async');
var path = require('path');

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
  console.log("Keeping track of %s modules", this.knownModules.length);
  return added;
};

ModuleStats.prototype._checkModule = function _checkModule(module, callback) {
  var mtimes = this.mtimes;

  if (!(module in mtimes)) {
    // Module not previously known to us
    return fs.stat(module, function(err, stat) {
      mtimes[module] = err ? 0 : stat.mtime;
      callback(false);
    });
  }

  fs.stat(module, function(err, stat) {
    callback(!err && stat.mtime.getTime() > mtimes[module].getTime());
  });
};

ModuleStats.prototype.check = function check(callback) {
  var now = new Date().getTime();
  var sincePrevCheck = now - this._prevCheck;
  console.log("Time since last check: %sms", sincePrevCheck);
  if (this.options.throttle && sincePrevCheck < this.options.throttle) {
    console.log("Throttled... %sms < %sms since prev check", sincePrevCheck, this.options.throttle);
    return callback(false);
  }
  this._prevCheck = now;
  async.detect(this.knownModules, this._checkModule.bind(this), callback);
};