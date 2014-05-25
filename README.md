# Proxyreload

Puts your node web server behind a proxy, and restarts it when source files has changed. You know, for development productivity.

`proxyreload` is work in progress.

# Why?

Existing tools usually doesn't work that well with OSX due to compatibility issues with `fs.watch` and
therefore falls back to polling the filesystem for changes. This means they are slower at picking up changes than they need to be, and puts a higher than necessary load on the CPU for large projects.

This problem is really painful when you hit the reload button before the file change is detected, and the server serves
you the old version when the new version is what you'd expect.

If you hit reload before the server is completely restarted, one of these *three* things may happen:

1. The request is processed and completed *before* the monitor has even detected that the change occurred. You will get the previous version, not the new as you would expect.
2. The request is *partially* processed before changes are detected, and you may end up with a broken page where the HTML may be served, but remaining requests for other resources (js/css) may be aborted by the restarting server.
3. The server is down, busy restarting.

In my experience, I end up hitting reload approximately three times before the server is finally restarted.

* `proxyreload` checks require.cache at *incoming* requests to see if any of the loaded files has changed since the previous request.

* if a change is detected it will puts any incoming request on
hold until the app is fully restarted and ready to handle the request.


# Assumptions / current limitations

* There are (currently) no way to tell the browser to reload. You will have to hit reload.

* Your app will run in a single child process.

* Your app must be exported as a module and not serve the web server by itself

Since `proxyreload` listens on the port you'd originally use to bind you app on, `proxyreload` must be able to bind your app to another (temporary) port (by default the first available port staring from `60000`).

* I've not tested this in a huge project that require()s a *lot* of modules.
On my MacBookPro Retina with SSD, an average-sized project with ~600 require()d modules, `proxyreload` adds an additional overhead of ~ 30ms to each request.

* Only files in require.cache will trigger a full reload of the app. Static files, resources, etc. should be served as-is
 or bundled on the fly.

# Usage

```
  Usage: proxyreload [options] <app.js>

  Options:

    -h, --help            output usage information
    -V, --version         output the version number
    -p, --port <n>        run the proxy on this port. This is the port you will access your app at (default 3000)
    -a, --app-port <n>    run the (non-proxied) app on this port (defaults to the first available port above 60000)
    -t, --throttle <n>ms  don't check for changes if its less than this value (in ms) since previous check
```

where `app.js` is a module that exports a single function that handles requests and thus can be passed to node's `http` server.
If you are using Express, this is the value returned from calling `express()`:

```js
// app.js

var app = express();

// (... set up the express app)

module.exports = app;
```
