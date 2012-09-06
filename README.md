winex
=====

[Winston][winston]-based [Express][express] logging middleware. Extracts
basic metadata from the request and logs out on request end (so the status
code of an HTTP response is captured).

[winston]: https://github.com/flatiron/winston
[express]: http://expressjs.com

Middleware
==========
Winex provides a basic middleware hook that attaches a Winston logger to
`req.locals._log` that can be used within any middleware or request handlers.
Add the middleware like:

    var express = require('express'),
      // Real winston logger.
      winston = require('winston'),
      winLogger = new winston.Logger(),
      // Winex wrapper.
      winex = require('winex'),
      Log = winex.factory(winLogger),
      app = express.createServer();

    app.configure(function () {
      // Log all requests.
      app.use(Log.middleware);
    });

Handlers
========
Winex also provides some express / general exception handlers that will be
documented at some point in the future.

License
=======
Winex is Copyright 2012 Curiosity Media, Inc. Released under the MIT License.
