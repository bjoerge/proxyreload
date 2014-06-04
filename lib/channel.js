var Promise = require("bluebird");

var baseId = Math.random().toString(32).substring(2) + ":" + process.pid;
var messageCount = 0;
function makeMessageId() {
  return baseId + ":" + (++messageCount);
}

function Channel(process) {
  this.handlers = {};
  this._messageHandler = this.onMessage.bind(this);
  if (process) {
    this.setProcess(process);
  }
}

Channel.prototype.setProcess = function setProcess(process) {
  if (this.process) {
    this.reset();
  }
  this.process = process;
  this.process.on('message', this._messageHandler);
};

Channel.prototype.reset = function reset() {
  this.process.removeListener('message', this._messageHandler);
  this.process = null;
};

Channel.prototype.send = function send(command, data) {

  var resolver = Promise.defer();

  var messageId = makeMessageId();

  var message = {id: messageId, command: command, data: data};

  this.process.on('message', waitForReply);
  this.process.send(message);

  return resolver.promise
    .timeout(5000)
    .finally(function () {
      this.process.removeListener('message', waitForReply);
    }.bind(this));

  function waitForReply(msg) {
    if (msg.replyTo === messageId) {
      switch (msg.status) {
        case 'success':
          resolver.resolve(msg.data);
          break;
        case 'error':
          var e = new Error(msg.error.message);
          e.stack = msg.error.stack;
          resolver.reject(e);
          break;
      }
    }
  }
};

Channel.prototype.handle = function handle(command, handler) {
  this.handlers[command] = handler;
};

Channel.prototype.onMessage = function onMessage(message) {
  var _process = this.process;
  if (message.command && (message.command in this.handlers)) {
    var handler = this.handlers[message.command];
    return handler(message.data)
      .catch(function (error) {
        _process.send({replyTo: message.id, status: 'error', error: {message: error.message, stack: error.stack}})
      })
      .then(function (result) {
        _process.send({replyTo: message.id, status: 'success', data: result})
      });
  }
};

module.exports = Channel;