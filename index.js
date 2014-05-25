var ModuleStats = require("./lib/module-stats");

module.exports = function(opts) {
  opts = opts || {};

  var throttle = 'throttle' in opts ? opts.throttle : 0; 
  var moduleStats = new ModuleStats({watchDir: process.cwd(), throttle: throttle});

  process.nextTick(function() {
    moduleStats.update(Object.keys(require.cache));
  });

  process.on('message', function(message) {
    switch(message) {
      case 'check':
        moduleStats.check(function(changed) {
          console.log("No change!");
          process.send(changed ? 'yes' : 'no');
        });
        return;
    }
  });  

  return function sync(req, res, next) {
    // Update known modules
    moduleStats.update(Object.keys(require.cache));
    next();
  };    
};

