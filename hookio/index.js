/*
 * hookio/index.js
 *
 * The Index for the hookio module
 * Initializes and sets up a hook.io server session
 */

var events = require('events'),	
  multipart = require('./lib/multipart'),
  debug = require("./lib/node_debug/node_debug/debug"),
  http_port = null,
  tcp_port = null;

// In case we want to run multiple instances at once
if (process.argv[2])
  http_port = parseInt(process.argv[2]);

// In case we want to run multiple instances at once
if (process.argv[3])
  tcp_port = parseInt(process.argv[3]);

// The HookIO object
var hookIO = {
  // Constants
  PATH: __dirname,
  EMAIL_DEFAULTS: {
    'from': 'noreply@hook.io'
  },
  DB: {
    path: __dirname + '/db/data.db'
  },
  HTTP: {
    defaultHeaders: {
      'Content-Type': 'text/html'
    },
    clientHeaders: {
      'User-Agent': 'hook.io Web Hooker'
    },
    port: http_port || 8000
  },
  DEBUGGER : {
    'webconsole':true, // should we output to the node_debug web console at http://hook.io/debug/
    'console':false, // should we output to the terminal console
    'emittedEvents':false  // should we output emittedEvents
  }
};

// check if node_debug should be turned on

if(hookIO.DEBUGGER.webconsole){
  /* this will start node_debug on port 8080
   be aware that running node_debug on a public IP address will result in your box getting rooted (or worse)
  */
  debug.listen(8080);
}


// Inherit from EventEmitter
/* tim - not sure why the new line was choking but there was an issue with the above hookIO options hash not being defined */
//hookIO = Object.create(events.EventEmitter.prototype);
hookIO = (function() {
  var fn;
  (fn = new Function()).prototype = new events.EventEmitter();
  process.mixin(fn.prototype, hookIO);
  return new fn();
})();

exports.hookIO = hookIO;

// Debugger
var sys = require('sys');
hookIO._emit = hookIO.emit;
hookIO.emit = function() {
  arguments = Array.prototype.slice.call(arguments, 0);
  
  if(hookIO.DEBUGGER.emittedEvents){
    debug.log(arguments);
  }
  
  hookIO._emit.apply(hookIO, arguments);
};

hookIO.debug = require('./lib/node_debug/node_debug/debug').log;

hookIO.outgoing = require('./outgoing');
hookIO.incoming = require('./incoming');

hookIO.api = require('./api');
hookIO.jsonrpc = require('./jsonrpc');
hookIO.site = require('./site');

hookIO.hooker = require('./hooker');
hookIO.actioner = require('./actioner');

hookIO.db = require('./db');

hookIO.protocol = {};

// TODO : add better way to load protocols
// this is where protocols get imported into hookIO
// currently protocols have an optional method "start"
// if the start method is exported in a protocol it will be called when hook.io first starts (here)

hookIO.protocol.http = require('./protocols/http');
hookIO.protocol.twitter = require('./protocols/twitter');
hookIO.protocol.timer = require('./protocols/timer');
hookIO.protocol.debug = require('./protocols/debug');
hookIO.protocol.email = require('./protocols/email');

/*
var result = {};
 fs.readdir(hookIO.PATH + '/definitions/actions', function(error, files) {
   files.forEach(function(action) {
     if ('.js' !== action.slice(-3))
       return;
     action = action.slice(0, -3);
     action = require(hookIO.PATH + '/definitions/actions/' + action);
   });
*/

exports.init = function(callback) {
  // Set-up the server bits and pieces

  // hooker.update() will load all hook listener definitions
  hookIO.hooker.update(function() {
    // actioner.update() will load all hook action definitions																																
    hookIO.actioner.update(function() {
      // Other services
      hookIO.db.init(function() {
        // Start http and tcp services
        hookIO.protocol.http.start();
        hookIO.protocol.twitter.start();
        // Start timer
        hookIO.protocol.timer.start();
        // We are inited
        if ('function' === typeof callback)
          callback.call(hookIO);
      });
    });
  });

  // Make sure we aren't called again
  delete exports.init;
};
