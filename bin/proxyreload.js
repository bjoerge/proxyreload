#!/usr/bin/env node

var path = require('path');
var program = require('commander');
var Promise = require('bluebird');
var express = require('express');
var url = require('url');
var httpProxy = require('http-proxy');

program
  .version(require("../package.json").version)
  .usage('[options] <app.js>')
  .option('-p, --port <n>', 'run the proxy on this port. This is the port you will access your app at (default 3000)', Number, 3000)
  .option('-a, --app-port <n>', 'run the (non-proxied) app on this port (defaults to the first available port above 60000)', Number)
  .option('-t, --throttle <n>ms', 'don\'t check for changes if its less than this value (in ms) since previous check', Number, 0)
  .parse(process.argv);

var appFile = path.join(process.cwd(), program.args[0]);

var getAvailPort = Promise.cast(program.appPort).then(function (port) {
  return port ? port : Promise.promisify(require("getport"))(60000, 60100)
});

// The proxy server.
// Defines an express app responsible for setting up target servers in child processes (listening on random ports)
// and orchestrating check-change commands to the target servers on incoming requests.

var AppProcess = require("../lib/app-process.js");

var proxyApp = express();

var appProcess;

var appProcessOpts = {
  appFile: appFile,
  throttle: program.throttle
};

var ready = getAvailPort.then(function(availPort) {
  appProcessOpts.port = availPort;
  appProcess = new AppProcess(appProcessOpts);
  return appProcess.start();
});

var proxy = httpProxy.createProxyServer();

// Middleware for handling all incoming requests
proxyApp.use(function (req, res) {

  var start = new Date();
  appProcess.checkNeedsReload()
    .then(function (needsReload) {
      console.log('Need to reload?', needsReload);
      if (needsReload) {
        return appProcess.restart();
      }
    })
    .catch(showErr)
    .then(forward);

  function showErr(e) {
    res.send(502, "App has crashed... fix the bug and reload :)");
  }

  function forward() {
    var target = url.parse(req.url);
    target.port = appProcessOpts.port;
    target.pathname = req.path;
    console.log("Had an additional overhead of %s ms", new Date().getTime() - start);
    proxy.web(req, res, {target: target}, function (e) {

    });
  }
});

proxyApp.listen(program.port, function (err) {
  if (err) {
    return console.error(err);
  }
  console.log("Proxyreload is listening on port %s", program.port);
});
