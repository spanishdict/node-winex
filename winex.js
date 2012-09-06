// Generated by CoffeeScript 1.3.3
(function() {
  var HOST_NAME, Handlers, WORKER_ID, clientIp, extend, factory, os, stripNulls, url, _Log,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  os = require("os");

  url = require("url");

  extend = require("deep-extend");

  HOST_NAME = os.hostname();

  WORKER_ID = (function() {
    var wid;
    wid = process.env.NODE_WORKER_ID;
    if (wid) {
      return "w" + wid;
    } else {
      return "m";
    }
  })();

  _Log = {
    error: function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return console.log.apply(this, ["[ERROR]"].concat(args));
    }
  };

  Handlers = {
    uncaughtException: function(err) {
      var log, _ref, _ref1;
      try {
        log = new _Log({
          type: "uncaught_exception",
          error: err
        });
        return log.error("Uncaught exception");
      } catch (other) {
        console.log((err ? (_ref = err.stack) != null ? _ref : err : "Unknown"));
        console.log("Error: Hit additional error logging the previous error.");
        return console.log((other ? (_ref1 = other.stack) != null ? _ref1 : other : "Unknown"));
      } finally {
        process.exit(1);
      }
    },
    createExpressHandler: function(express, opts) {
      var expressHandler;
      expressHandler = express.errorHandler(opts);
      return function(err, req, res, next) {
        var log;
        log = new _Log({
          req: req,
          res: res,
          error: err,
          meta: {
            type: "unhandled_error"
          }
        });
        log.error("unhandled error");
        return expressHandler(err, req, res, next);
      };
    }
  };

  stripNulls = function(obj) {
    var k, v;
    for (k in obj) {
      if (!__hasProp.call(obj, k)) continue;
      v = obj[k];
      if (v === null) {
        delete obj[k];
      }
    }
    return obj;
  };

  clientIp = function(req) {
    var firstIp, forwards, ipAddr, ips, _ref, _ref1;
    ipAddr = req != null ? (_ref = req.connection) != null ? _ref.remoteAddress : void 0 : void 0;
    forwards = req != null ? typeof req.header === "function" ? req.header("x-forwarded-for") : void 0 : void 0;
    if (forwards) {
      ips = forwards.split(",");
      firstIp = ((_ref1 = ips != null ? ips[0] : void 0) != null ? _ref1 : "").replace(/^\s+|\s+$/, "");
      if (firstIp) {
        ipAddr = firstIp;
      }
    }
    return ipAddr;
  };

  factory = function(winstonLogger, classMeta) {
    var Log;
    if (classMeta == null) {
      classMeta = {};
    }
    Log = (function() {
      var level, _fn, _i, _len, _ref,
        _this = this;

      function Log(opts) {
        var _ref, _ref1;
        if (opts == null) {
          opts = {};
        }
        this.baseMeta = __bind(this.baseMeta, this);

        this.meta = extend({}, (_ref = opts.meta) != null ? _ref : {});
        this.type = (_ref1 = opts.type) != null ? _ref1 : null;
        this.errNoStack = opts.errNoStack === true;
        if (opts.req) {
          this.addReq(opts.req);
        }
        if (opts.error) {
          this.addError(opts.error);
        }
        this.nop = Log.nopLogger;
      }

      Log.prototype.DEFAULT_TYPE = "request";

      Log.middlewareNop = function() {
        return function(req, res, next) {
          req._log = Log.nopLogger;
          return next();
        };
      };

      Log.middleware = function(opts) {
        if (opts == null) {
          opts = {};
        }
        return function(req, res, next) {
          var log, _end;
          log = new Log(opts);
          log.addReq(req);
          req._log = log;
          _end = res.end;
          res.end = function(chunk, encoding) {
            var level, _ref;
            res.end = _end;
            res.end(chunk, encoding);
            if (!res.req._log) {
              return;
            }
            level = "info";
            if ((400 <= (_ref = res.statusCode) && _ref < 500)) {
              level = "warning";
            }
            if (res.statusCode >= 500) {
              level = "error";
            }
            log.addRes(res);
            return log[level]("request");
          };
          return next();
        };
      };

      Log.prototype.addReq = function(req) {
        var maxChars, path, query, queryChars, urlObj, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
        if (req == null) {
          req = {};
        }
        maxChars = 200;
        urlObj = url.parse(req != null ? req.url : void 0);
        path = urlObj != null ? urlObj.pathname : void 0;
        query = (_ref = urlObj != null ? urlObj.query : void 0) != null ? _ref : "";
        queryChars = query != null ? query.length : void 0;
        if (path.length > maxChars) {
          path = path.substr(0, maxChars);
        }
        if (queryChars > maxChars) {
          query = query.substr(0, maxChars);
        }
        return this.meta = extend(this.meta, stripNulls({
          reqClient: clientIp(req),
          reqHost: (_ref1 = req != null ? (_ref2 = req.headers) != null ? _ref2.host : void 0 : void 0) != null ? _ref1 : null,
          reqMethod: (_ref3 = req != null ? req.method : void 0) != null ? _ref3 : null,
          reqPath: path,
          reqQuery: query,
          reqQueryChars: queryChars,
          reqUser: (_ref4 = req != null ? (_ref5 = req.user) != null ? _ref5.email : void 0 : void 0) != null ? _ref4 : null
        }));
      };

      Log.prototype.addRes = function(res) {
        if (res == null) {
          res = {};
        }
        return this.meta = extend(this.meta, {
          resStatus: res.statusCode
        });
      };

      Log.prototype.addError = function(error) {
        var errObj, _ref, _ref1, _ref2, _ref3;
        if (error == null) {
          error = "unknown";
        }
        errObj = {
          errMsg: (_ref = error != null ? error.message : void 0) != null ? _ref : error.toString()
        };
        if (!this.errNoStack) {
          extend(errObj, stripNulls({
            errArgs: ((_ref1 = error != null ? error["arguments"] : void 0) != null ? _ref1 : "").toString().substr(0, 100),
            errType: (_ref2 = error != null ? error.type : void 0) != null ? _ref2 : null,
            errStack: (_ref3 = error != null ? error.stack : void 0) != null ? _ref3 : null,
            errKnown: 0
          }));
        }
        return this.meta = extend(this.meta, errObj);
      };

      Log.aggregateMeta = function() {
        var metas;
        metas = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return Log.patchMeta.apply(Log, [{}].concat(metas));
      };

      Log.patchMeta = function() {
        var key, m, meta, metas, obj, value, _i, _len, _ref, _ref1;
        metas = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        metas = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = metas.length; _i < _len; _i++) {
            m = metas[_i];
            if (m != null) {
              _results.push(m);
            }
          }
          return _results;
        })();
        obj = metas.length > 0 ? metas[0] : {};
        _ref = metas.slice(1);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          meta = _ref[_i];
          for (key in meta) {
            if (!__hasProp.call(meta, key)) continue;
            value = meta[key];
            if (typeof value === "number") {
              obj[key] = ((_ref1 = obj[key]) != null ? _ref1 : 0) + value;
            } else if ((value != null ? value.concat : void 0) != null) {
              if (obj[key] == null) {
                obj[key] = [];
              }
              obj[key] = obj[key].concat(value);
            } else {
              obj[key] = value;
            }
          }
        }
        return obj;
      };

      Log.prototype.baseMeta = function(meta, level) {
        var _ref;
        if (meta == null) {
          meta = {};
        }
        if (level == null) {
          level = null;
        }
        return extend({
          date: (new Date()).toISOString(),
          level: level || meta.level,
          env: process.env.NODE_ENV,
          type: (_ref = meta != null ? meta.type : void 0) != null ? _ref : this.DEFAULT_TYPE,
          serverHost: HOST_NAME,
          serverId: WORKER_ID,
          serverPid: process.pid
        }, classMeta, meta);
      };

      Log.prototype._makeMeta = function(level, meta) {
        var type, _ref, _ref1, _ref2;
        if (meta == null) {
          meta = {};
        }
        type = (_ref = (_ref1 = (_ref2 = meta.type) != null ? _ref2 : this.meta.type) != null ? _ref1 : this.type) != null ? _ref : this.DEFAULT_TYPE;
        meta = extend(this.baseMeta(null, level), this.meta, meta);
        meta.type = type;
        return meta;
      };

      _ref = Object.keys(winstonLogger.levels);
      _fn = function(level) {
        return Log.prototype[level] = function(msg, metaOrCb, cb) {
          var callback, meta;
          if (metaOrCb == null) {
            metaOrCb = {};
          }
          if (cb == null) {
            cb = null;
          }
          if (cb != null) {
            meta = metaOrCb != null ? metaOrCb : {};
            callback = cb;
          } else if (metaOrCb != null) {
            meta = typeof metaOrCb === "object" ? metaOrCb : {};
            callback = typeof metaOrCb === "function" ? metaOrCb : null;
          }
          meta = this._makeMeta(level, meta);
          return winstonLogger[meta.level].apply(Log, [msg, meta, callback]);
        };
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        level = _ref[_i];
        _fn(level);
      }

      Log.nopLogger = (function() {
        var obj, _fn1, _j, _len1, _ref1;
        obj = {};
        _ref1 = Object.keys(winstonLogger.levels);
        _fn1 = function(level) {
          return obj[level] = function() {};
        };
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          level = _ref1[_j];
          _fn1(level);
        }
        return obj;
      })();

      return Log;

    }).call(this);
    _Log = Log;
    return Log;
  };

  module.exports = {
    Handlers: Handlers,
    factory: factory
  };

}).call(this);
