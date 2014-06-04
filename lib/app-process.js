// Keeps track of the app child process

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Channel = require('./channel');
var inherits = require('util').inherits;
var fork = require('child_process').fork;
var path = require('path');

module.exports = AppProcess;

function once(method) {
  var current = null;
  return function () {
    current = current || method.apply(this, arguments);
    current.finally(function() {
      current = null;
    });
    return current;
  }
}

function AppProcess(opts) {
  EventEmitter.call(this);
  this.opts = opts;
  this.process = null;
  this.channel = new Channel();
  this.channel.handle('log', this.handleLog.bind(this));
  this._startup = null;
}
inherits(AppProcess, EventEmitter);

AppProcess.prototype.handleLog = function (message) {
  this.emit('log', message);
};

AppProcess.prototype.start = once(function () {
  this.process = fork(path.join(__dirname, '/..', '/bin/run-app.js'));
  this.channel.setProcess(this.process);

  var startup = this._startup = this.channel.send('start', {
    throttle: this.opts.throttle,
    app: this.opts.app,
    port: this.opts.port
  })
    .cancellable();

  var cancelUpstart = function () {
    throw new Promise.CancellationError("Child process disconnected before it was ready to handle requests");
  };

  this.process.on('exit', cancelUpstart);
  this.process.on('exit', function() {
    this._startup = null;
    this.restart();
  }.bind(this));

  startup.finally(function () {
    this.process.removeListener('exit', cancelUpstart);
  }.bind(this));

  return startup;
});

AppProcess.prototype.stop = once(function () {
  return new Promise(function (resolve) {
    this.process.once('exit', function () {
      resolve()
    });
    this.process.kill();
  }.bind(this))
    .timeout(2000)
    .tap(function () {
      this.emit('stop')
    }.bind(this));
});

AppProcess.prototype.restart = once(function () {
  return this.stop().then(this.start.bind(this));
});

AppProcess.prototype.maybeRestart = once(function () {

  if (!this._startup) {
    return this.start();
  }

  if (this._startup.isRejected()) {
    return this.restart();
  }

  if (this._startup.isResolved()) {
    return this.channel.send('check').then(function (changed) {
      if (changed.length > 0) {
        return this.restart();
      }
      return this._startup;
    }.bind(this))
  }

  return this._startup;

});
