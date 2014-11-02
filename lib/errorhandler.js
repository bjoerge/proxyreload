var fs = require('fs');
var ejs = require('ejs');
var log = require('./log');
var stackTrace = require('stack-trace');
var escape = require('escape-html');

module.exports = errorhandler;

function repeat(str, times) {
  var res = "";
  while (times--) {
    res += str;
  }
  return res;
}

function getContext(callSites, cb) {

  var gotSource = function(callSite, source) {
    var lines = source.toString().split("\n");
    var before = Math.max(callSite.lineNumber-5, 0);
    var after = Math.min(callSite.lineNumber+5, lines.length);
    var context = [];
    for (var i = before; i < after; i++) {
      context.push('<span class="lineno">'+i+'</span>'+' '+escape(lines[i]));
      if (i === callSite.lineNumber-1) {
        context.push('<span class="errormarker">'+repeat("-", callSite.columnNumber+String(i).length)+"^</span>");
      }
    }
    return cb(null, context.join("\n"));    
  };

  if (callSites.length === 0 || callSites[0].lineNumber === null) {
    cb(null);
    return;
  }
  fs.readFile(callSites[0].fileName, function(err, source) {
    if (!err) {
      return gotSource(callSites[0], source.toString())
    }
    // Try with the next module
    return fs.readFile(callSites[1].fileName, function(err, source) {
      if (err) {
        return cb(err, null)
      }
      gotSource(callSites[1], source.toString())
    });

  });
}

function errorhandler(error, req, res, next) {
  var compiledTemplate;
  fs.readFile(__dirname + '/../resources/error.html', 'utf8', function (err, templateStr) {
    if (err) {
      return next(err);
    }
    compiledTemplate = ejs.compile(templateStr.toString());
    showErr()
  });

  function showErr() {
    var threwString = typeof error === 'string';
    if  (threwString) {
      error = new Error(error);
    }
    log.error(error);

    var trace = stackTrace.parse(error).filter(function(callSite) {
      // Filter out 'module.js' shimmed filename
      return callSite.fileName !== 'module.js';
    });

    var linkedStack = trace.map(function(callSite) {
      var loc = [callSite.fileName, callSite.lineNumber, callSite.columnNumber].join(":");
      var functionName = callSite.functionName || '<anonymous>';
      return '<span class="functionName">'+functionName+'</span>'+'(<span class="fileref">'+loc+'</span>)';
    }).join("\n at ");

    getContext(trace, function(err, context) {
      if (err) {
        context = "";
      }

      res.send(502, compiledTemplate({
        message: error.message,
        stack: linkedStack,
        context: context,
        threwString: threwString
      }));      
    });

  }
}