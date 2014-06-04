var clc = require("cli-color");

var prefix = 'proxyreload';

function error(error) {
  var stack = null;
  var message;
  if (error.stack) {
    var stackLines = error.stack.split("\n");
    message = stackLines[0];
    stack = stackLines.slice(1).join('\n');
  }
  else {
    message = error;
  }
  
  console.error('[%s] [%s] %s:', prefix, clc.red('error'), message);

  if (stack) {
    console.error(clc.blackBright(stack));
  }
}

function info(msg) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.log.apply(console, ['[%s] [%s] '+ msg, prefix, clc.green('info')].concat(args))
}

function warning(msg) {
  var args = Array.prototype.slice.call(arguments, 1);
  console.log.apply(console, ['[%s] [%s] '+ msg, prefix, clc.yellow('warn')].concat(args))
}

module.exports = {
  error: error,
  info: info,
  warning: warning
};