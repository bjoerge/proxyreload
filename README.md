# Proxyreload

Puts your node web server behind a proxy, and restarts it when source files has changed. You know, for development productivity.

# Why?

Existing tools usually don't work that well with OSX due to compatibility issues with `fs.watch` and
therefore falls back to polling the filesystem. This means they are slower at picking up changes than they need to be, and 
puts a higher than necessary load on the CPU for large projects.

This problem is really painful when you hit the reload button before the file change is detected, and the server serves
you the old version when the new version is what you'd expect.

If you hit reload before the server is completely restarted, one of these *three* things may happen:

1) The request is processed and completed *before* the monitor has even detected that the change occurred. You will get an older version than you'd expect.
2) The request is *partially* processed before changes are detected, and you may end up with a broken page where the HTML may be served, but
 requests for other resources (js/css) may be aborted by the restarting server.
3) The server is down, busy restarting

In my experience, I end up hitting reload approximately three times before the server is finally restarted.

* `proxyreload` checks require.cache at *incoming* requests to see if any of the loaded files has changed since the previous request.

* if a change is detected it will puts any incoming request on
hold until the app is fully restarted and ready to handle the request.

# Don't kill my server when I edit browser-only code.
It is super-annoying to have to wait for the server to restart when the only code edits you've done were in files that is only run browser-side.
(And please don't tell me to add exclude rules for all my client side code)


# Assumptions / limitations

* There are (currently) no way to tell the browser to reload. You will have to hit reload.

* Your app is started in a single child process.

* Your http app must be exported by a module and not bind to a port by itself

Since `proxyreload` listens on the port you'd originally use to bind you app on, `proxyreload` must be able to bind your app
  to another (temporary) port.

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

# Benchmarks

```
$ proxyreload app.js
Proxyreload is listening on port 3000
Keeping track of 615 modules
App is listening on port 60000
```

## Directly to app server (baseline)

```
$ ab -c 10 -n 100 http://localhost:60000/

This is ApacheBench, Version 2.3 <$Revision: 655654 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking localhost (be patient).....done


Server Software:
Server Hostname:        localhost
Server Port:            60000

Document Path:          /
Document Length:        1270 bytes

Concurrency Level:      10
Time taken for tests:   0.303 seconds
Complete requests:      100
Failed requests:        83
   (Connect: 0, Receive: 0, Length: 83, Exceptions: 0)
Write errors:           0
Total transferred:      146044 bytes
HTML transferred:       128058 bytes
Requests per second:    330.13 [#/sec] (mean)
Time per request:       30.291 [ms] (mean)
Time per request:       3.029 [ms] (mean, across all concurrent requests)
Transfer rate:          470.84 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.0      0       0
Processing:    20   29   4.4     28      47
Waiting:       19   29   4.4     28      47
Total:         20   29   4.4     29      48

Percentage of the requests served within a certain time (ms)
  50%     29
  66%     30
  75%     31
  80%     32
  90%     33
  95%     40
  98%     47
  99%     48
 100%     48 (longest request)
```

## Through proxy (no throttle)

```
$ ab -c 10 -n 100 http://localhost:3000
This is ApacheBench, Version 2.3 <$Revision: 655654 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking localhost (be patient).....done


Server Software:
Server Hostname:        localhost
Server Port:            3000

Document Path:          /
Document Length:        1271 bytes

Concurrency Level:      10
Time taken for tests:   1.128 seconds
Complete requests:      100
Failed requests:        88
   (Connect: 0, Receive: 0, Length: 88, Exceptions: 0)
Write errors:           0
Total transferred:      145822 bytes
HTML transferred:       127816 bytes
Requests per second:    88.68 [#/sec] (mean)
Time per request:       112.763 [ms] (mean)
Time per request:       11.276 [ms] (mean, across all concurrent requests)
Transfer rate:          126.29 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.0      0       0
Processing:    99  112  10.1    111     134
Waiting:       99  112  10.1    111     134
Total:         99  112  10.1    111     134

Percentage of the requests served within a certain time (ms)
  50%    111
  66%    112
  75%    113
  80%    127
  90%    130
  95%    134
  98%    134
  99%    134
 100%    134 (longest request)
```

## Through proxy (--throttle 100)

```
ab -c 10 -n 100 http://localhost:3000/
This is ApacheBench, Version 2.3 <$Revision: 655654 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking localhost (be patient).....done


Server Software:
Server Hostname:        localhost
Server Port:            3000

Document Path:          /
Document Length:        1270 bytes

Concurrency Level:      10
Time taken for tests:   0.373 seconds
Complete requests:      100
Failed requests:        77
   (Connect: 0, Receive: 0, Length: 77, Exceptions: 0)
Write errors:           0
Total transferred:      145906 bytes
HTML transferred:       127912 bytes
Requests per second:    268.18 [#/sec] (mean)
Time per request:       37.288 [ms] (mean)
Time per request:       3.729 [ms] (mean, across all concurrent requests)
Transfer rate:          382.12 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.0      0       0
Processing:    22   36  15.2     31      87
Waiting:       22   36  15.2     31      87
Total:         22   36  15.2     31      87

Percentage of the requests served within a certain time (ms)
  50%     31
  66%     34
  75%     36
  80%     43
  90%     57
  95%     81
  98%     86
  99%     87
 100%     87 (longest request)
```
