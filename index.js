var ModuleStats = require("./lib/module-stats");

module.exports = function (opts) {
  opts = opts || {};

  var throttle = 'throttle' in opts ? opts.throttle : 0;
  var moduleStats = new ModuleStats({throttle: throttle});

  var parent = opts.channel;

  process.nextTick(updateKnown);

  parent.handle('check', function () {
    return moduleStats.check();
  });

  return function sync(req, res, next) {
    // Update known modules
    updateKnown().then(function() {
      next();
    });
  };
  function updateKnown() {
    return moduleStats.update(Object.keys(require.cache));
  }
};
