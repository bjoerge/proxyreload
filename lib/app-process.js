// Keeps track of the app child process

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var inherits = require('util').inherits;
var fork = require('child_process').fork;
var path = require('path');

module.exports = AppProcess;

function AppProcess(opts) {
  EventEmitter.call(this);
  this.opts = opts;
  this.process = null;
  this.restarting = false;
}
inherits(AppProcess, EventEmitter);

AppProcess.prototype._waitFor = function (fn) {

  var resolver = Promise.defer();

  this.process.on('message', receive);
  this.process.on('error', error);
  this.process.on('exit', exit);

  resolver.promise.finally(function () {
    this.process.removeListener('message', receive);
    this.process.removeListener('error', error);
    this.process.removeListener('exit', exit);
  }.bind(this));

  return resolver.promise;

  function receive(message) {
    if (fn(message)) {
      resolver.resolve();
    }
  }

  function error(error) {
    resolver.reject(error);
  }

  function exit() {
    resolver.reject(new Error("exited"));
  }
};

AppProcess.prototype.start = function () {
  this.emit('start');
  this.process = fork(path.join(__dirname, '/..', '/bin/run-app.js'), [
    '-p', this.opts.port,
    '-t', this.opts.throttle,
    this.opts.appFile
  ]);

  this.process.on('exit', function () {
    if (!this.restarting) {
      this.emit('disconnect');
    }
  }.bind(this));

  return this._waitFor(function (message) {
    return message == 'ready';
  }).timeout(1500);
};

AppProcess.prototype.stop = function () {
  this.stopping = true;
  var resolver = Promise.defer();
  this.process.once('exit', function () {
    this.process = null;
    this.stopping = false;
    resolver.resolve();
  }.bind(this));
  this.process.kill();
  return resolver.promise.timeout(500);
};

AppProcess.prototype.restart = function () {
  return this.stop()
    .then(function () {
      return this.start();
    }.bind(this));
};

AppProcess.prototype.checkNeedsReload = function () {
  this.process.send('check');
  var resolver = Promise.defer();

  this.process.on('message', receive);

  return resolver.promise.timeout(1500).finally(function () {
    this.process.removeListener('message', receive);
  }.bind(this));

  function receive(message) {
    if (message == 'yes' || message === 'no') {
      resolver.resolve(message === 'yes');
    }
  }
};
