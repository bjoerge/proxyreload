var fs = require('fs');
var ejs = require('ejs');
var log = require('./log');
var stackTrace = require('stack-trace');

module.exports = errorhandler;

function repeat(str, times) {
  var res = "";
  while (times--) {
    res += str;
  }
  return res;
}

function getContext(callSite) {
  var lines = fs.readFileSync(callSite.fileName).toString().split("\n");
  var before = Math.max(callSite.lineNumber-5, 0);
  var after = Math.min(callSite.lineNumber+5, lines.length);
  var context = [];
  for (var i = before; i < after; i++) {
    context.push('<span class="lineno">'+i+'</span>'+' '+lines[i]);
    if (i === callSite.lineNumber-1) {
      context.push('<span class="errormarker">'+repeat("-", callSite.columnNumber+String(i).length)+"^</span>");
    }
  }
  return context.join("\n");
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

    var trace = stackTrace.parse(error);

    var linkedStack = trace.map(function(callSite) {
      var loc = [callSite.fileName, callSite.lineNumber, callSite.columnNumber].join(":");
      var functionName = callSite.functionName || '<anonymous>';
      return '<span class="functionName">'+functionName+'</span>'+'(<span class="fileref">'+loc+'</span>)';
    }).join("\n at ");
    
    res.send(502, compiledTemplate({
      message: error.message,
      stack: linkedStack,
      context: trace[0] && getContext(trace[0]),
      threwString: threwString
    }))
  }
}