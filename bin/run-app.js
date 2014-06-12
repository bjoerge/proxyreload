#!/usr/bin/env node
var path = require('path');
var program = require('commander');
var express = require('express');
var Channel = require("../lib/channel");
var Promise = require("bluebird");
Promise.onPossiblyUnhandledRejection(null);

var getPort = Promise.promisify(require("getport"));

var channel = new Channel(process);

channel.handle('start', function (options) {

  var wrapper = express().use(require("..")({
    channel: channel,
    throttle: options.throttle
  }));

  return new Promise(function (resolve, reject) {
    process.nextTick(function() {
      try {
        wrapper.use(require(options.app));
        wrapper.use(require("../lib/errorhandler"))
      }
      catch(e) {
        var stackTrace = require('stack-trace');
        var trace = stackTrace.parse(e);
        var error = new Error();
        error.message = e.message;
        error.stack = e.stack;
        reject(error);
      }
      resolve();
    });
  })
    .then(function () {
      return getPort(options.port, options.port + 100);
    })
    .then(function (port) {
      return new Promise(function (resolve, reject) {
        wrapper.listen(options.port, function (err) {
          if (err) {
            reject(err);
          }
          resolve({port: port});
        });
      });
    })
});
