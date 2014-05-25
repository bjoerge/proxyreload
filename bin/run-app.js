#!/usr/bin/env node

var path = require('path');
var program = require('commander');
var express = require('express');

program
  .usage('[options] <appfile>')
  .option('-p, --port <n>', 'Port', Number)
  .option('-t, --throttle <n>', 'Throttle re-check', Number, 0)
  .parse(process.argv);

var appFile = program.args[0];
var port = program.port;

var app = express()
  .use(require("../")({throttle: program.throttle}))
  .use(require(appFile));

app.listen(port, function (err) {
  if (err) {
    return console.error(err);
  }
  process.send('ready');
  console.log("App is listening on port %s", port);
});