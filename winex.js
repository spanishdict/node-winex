// Generated by CoffeeScript 1.3.3
(function() {
  var HOST_NAME, Handlers, WORKER_ID, clientIp, cluster, extend, factory, os, stripNulls, uncaughtLogger, url, _Log,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  cluster = require("cluster");

  os = require("os");

  url = require("url");

  extend = require("deep-extend");

  HOST_NAME = os.hostname();

  WORKER_ID = (function() {
    var wid, _ref, _ref1, _ref2;
    wid = (_ref = (_ref1 = process.env.NODE_WORKER_ID) != null ? _ref1 : (_ref2 = cluster.worker) != null ? _ref2.id : void 0) != null ? _ref : null;
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

  uncaughtLogger = function(err, cleanup) {
    var log, _ref, _ref1;
    if (cleanup == null) {
      cleanup = function() {};
    }
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
      if (typeof cleanup === "function") {
        cleanup();
      }
    }
  };

  Handlers = {
    logUncaughtException: function(err) {
      return uncaughtLogger(err);
    },
    uncaughtException: function(err) {
      return uncaughtLogger(err, function() {
        return process.exit(1);
      });
    },
    createUncaughtHandler: function(server, opts) {
      var kill;
      if (opts == null) {
        opts = {
          timeout: 30000
        };
      }
      kill = function() {
        return process.exit(1);
      };
      return function(err) {
        return uncaughtLogger(err, function() {
          var timeout;
          timeout = setTimeout(kill, opts.timeout);
          if (server != null) {
            return server.close(function() {
              clearTimeout(timeout);
              return kill();
            });
          } else {
            return kill();
          }
        });
      };
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

  factory = function(winstonLogger, classMeta, opts) {
    var Log, NopLog, useNop;
    if (classMeta == null) {
      classMeta = {};
    }
    if (opts == null) {
      opts = {};
    }
    useNop = opts.nop === true;
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
      }

      Log.prototype.DEFAULT_TYPE = "request";

      Log.middleware = function(opts) {
        if (opts == null) {
          opts = {};
        }
        return function(req, res, next) {
          var log, _end;
          log = new Log(opts);
          log.addReq(req);
          res.locals._log = log;
          _end = res.end;
          res.end = function(chunk, encoding) {
            var level, _ref;
            res.end = _end;
            res.end(chunk, encoding);
            if (!res.locals._log) {
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

      Log.prototype.addMeta = function(meta) {
        if (meta == null) {
          meta = {};
        }
        return this.meta = extend(this.meta, meta);
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
        return Log.prototype[level] = function(msg, meta, cb) {
          if (meta == null) {
            meta = {};
          }
          if (cb == null) {
            cb = function() {};
          }
          meta = this._makeMeta(level, meta);
          return winstonLogger[meta.level].apply(Log, [msg, meta, cb]);
        };
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        level = _ref[_i];
        _fn(level);
      }

      return Log;

    }).call(this);
    NopLog = (function(_super) {
      var level, _fn, _i, _len, _ref,
        _this = this;

      __extends(NopLog, _super);

      function NopLog() {
        return NopLog.__super__.constructor.apply(this, arguments);
      }

      NopLog.middleware = function() {
        return function(req, res, next) {
          res.locals._log = new NopLog();
          return next();
        };
      };

      _ref = Object.keys(winstonLogger.levels);
      _fn = function(level) {
        return NopLog.prototype[level] = function() {};
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        level = _ref[_i];
        _fn(level);
      }

      return NopLog;

    }).call(this, Log);
    _Log = Log;
    if (useNop === true) {
      _Log = NopLog;
    }
    return _Log;
  };

  module.exports = {
    Handlers: Handlers,
    factory: factory
  };

}).call(this);
