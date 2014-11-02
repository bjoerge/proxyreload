#!/usr/bin/env node

var path = require('path');
var program = require('commander');
var Promise = require('bluebird');
var express = require('express');
var url = require('url');
var httpProxy = require('http-proxy');
var log = require("../lib/log");
var prettyMs = require("pretty-ms");

Promise.onPossiblyUnhandledRejection();

program
  .version(require("../package.json").version)
  .usage('[options] <app.js>')
  .option('-p, --port <n>', 'run the proxy on this port. This is the port you will access your app at (default 3000)', Number, 3000)
  .option('-s, --silent', "don't output proxyreload logging", Boolean, false)
  .option('-t, --throttle <n>ms', 'don\'t check for changes if its less than this value (in ms) since previous check', Number, 0)
  .parse(process.argv);

// The proxy server.
// Defines an express app responsible for setting up target servers in child processes (listening on random ports)
// and orchestrating check-change commands to the target servers on incoming requests.

var AppProcess = require("../lib/app-process.js");

var appProcess = new AppProcess({
  app: path.join(process.cwd(), program.args[0]),
  port: 60000,
  throttle: program.throttle
});

appProcess.on('log', function (logEvent) {
  log[logEvent.type]("%s", logEvent.message);
});

var proxyApp = express();
var proxy = httpProxy.createProxyServer();

// Middleware for handling all incoming requests
proxyApp.use(function (req, res, next) {
  var start = new Date().getTime();
  return appProcess
    .maybeRestart()
    .then(function forward(appServer) {
      var reqStart = new Date().getTime();
      var target = {port: appServer.port};
      proxy.web(req, res, {target: target}, function (e) {
        // Ignore socket hang up errors
        if (e && !e.code === 'ECONNRESET') next(e)
      });

      res.on('finish', function () {
        var now = new Date().getTime();
        var totalDuration = now - start;
        var requestDuration = now - reqStart;
        // request overhead caused by proxyreload
        var overhead = totalDuration - requestDuration;
        log.info("=> %s %s (%s +%s)", req.method, req.url, prettyMs(requestDuration), prettyMs(overhead));
      });
    })
    .catch(next);
});

proxyApp.use(require("../lib/errorhandler"));

proxyApp.listen(program.port, function (err) {
  if (err) {
    throw err;
  }
  log.info("Listening on port %s and forwarding to app whenever it is ready to receive requests", program.port);
});
