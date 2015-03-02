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
  wrapper.disable('x-powered-by');
  wrapper.use(require("..")({
    channel: channel,
    throttle: options.throttle
  }));

  return new Promise(function (resolve, reject) {
    var app;
    try {
      app = require(options.app)
    } catch(e) {

      // Traceur throws an *array* of error strings, wtf.
      if (Array.isArray(e)) {
        var onlyStrings = !e.some(function(err) {
          return typeof err != 'string'
        });
        if (onlyStrings) {
          e = e.join("\n");
        }
        else {
          e = e[0]
        }
      }

      if (e.stack && typeof e.stack === 'string') {
        var lines = e.stack.split("\n");
        lines.push("    at require ("+options.app+":0:0)")
        e.stack = lines.join("\n");
        reject(e);
      }
      else {
        e = new Error(e);
        e.stack = "";
        reject(e);
      }

    }

    if (app) {
      wrapper.use(app);
    }
    resolve();
  })
    .then(function () {
      return getPort(options.port, options.port + 100);
    })
    .then(function (port) {
      return new Promise(function (resolve, reject) {
        wrapper.use(require("../lib/errorhandler"));
        wrapper.listen(port, function (err) {
          if (err) {
            reject(err);
          }
          resolve({port: port});
        });
      });
    })
});
