#!/usr/bin/env node
var path = require('path');
var express = require('express');
var Channel = require("../lib/channel");
var Promise = require("bluebird");
Promise.onPossiblyUnhandledRejection(null);

var getPort = Promise.promisify(require("getport"));

var channel = new Channel(process);

channel.handle('start', function (options) {

  var wrapper = express();
  wrapper.use(require("..")({
    channel: channel,
    throttle: options.throttle
  }));
  return new Promise(function (resolve, reject) {
    try {
      wrapper.use(require(options.app));
    } catch(e) {
      var lines = e.stack.split("\n");
      lines.splice(1, 0, "    at require ("+options.app+":0:0)")
      e.stack = lines.join("\n");
      reject(e);
    }
    resolve();
  })
    .then(function () {
      return getPort(options.port, options.port + 100);
    })
    .then(function (port) {
      return new Promise(function (resolve, reject) {
        wrapper.use(require("../lib/errorhandler"));
        wrapper.listen(options.port, function (err) {
          if (err) {
            reject(err);
          }
          resolve({port: port});
        });
      });
    })
});
