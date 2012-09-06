os        = require "os"
url       = require "url"

extend    = require "deep-extend"

# Constants.
HOST_NAME = os.hostname()
WORKER_ID = do ->
  wid = process.env.NODE_WORKER_ID
  if wid then "w#{wid}" else "m"

# Default internal logger until set by factory.
# Yes, this is mutable global state, but factory should only be set once.
# Future extension is allow handlers to take own log class.
_Log      = error: (args...) -> console.log.apply @, ["[ERROR]"].concat(args)

###############################################################################
# Generic logging handlers.
###############################################################################
Handlers =
  # Permissively trap uncaught exceptions.
  #
  uncaughtException: (err) ->
    try
      log = new _Log
        type: "uncaught_exception"
        error: err
      log.error "Uncaught exception"
    catch other
      console.log (if err then (err.stack ? err) else "Unknown")
      console.log "Error: Hit additional error logging the previous error."
      console.log (if other then (other.stack ? other) else "Unknown")
    finally
      process.exit 1

  # Return handler function for express exceptions.
  #
  createExpressHandler: (express, opts) ->
    # Stash the configured express handler.
    expressHandler = express.errorHandler(opts)

    # Wrap with our log.
    (err, req, res, next) ->
      log = new _Log
        req:    req
        res:    res
        error:  err
        meta:   type: "unhandled_error"

      log.error "unhandled error"
      expressHandler err, req, res, next


###############################################################################
# Helpers
###############################################################################
# Strip nulls off object.
#
stripNulls = (obj) ->
  delete obj[k] for own k, v of obj when v is null
  obj

# Return client IP address.
#
# Follows 'x-forwarded-for'. See:
#  - http://catapulty.tumblr.com/post/8303749793/
#           heroku-and-node-js-how-to-get-the-client-ip-address
#  - http://awsdocs.s3.amazonaws.com/ElasticLoadBalancing/latest/elb-dg.pdf
#
clientIp = (req) ->
  ipAddr    = req?.connection?.remoteAddress
  forwards  = req?.header?("x-forwarded-for")

  if forwards
    # Use header forwards if possible.
    ips     = forwards.split(",")
    firstIp = (ips?[0] ? "").replace(/^\s+|\s+$/, "")
    ipAddr  = firstIp if firstIp

  ipAddr

###############################################################################
# Factory
###############################################################################
# Create a logger class.
#
# Winex needs an instance of a Winston logger to wrap.
#
# @param [Object] winstonLogger Winston logger.
# @param [Object] classMeta     Extra meta for every log call.
factory = (winstonLogger, classMeta = {}) ->

  # Logger.
  #
  class Log

    constructor: (opts = {}) ->
      # Member variables.
      @meta       = extend {}, (opts.meta ? {})
      @type       = opts.type ? null
      @errNoStack = opts.errNoStack is true

      # Patch in incoming data.
      @addReq   opts.req    if opts.req
      @addError opts.error  if opts.error

      # Make NOP available for switching.
      @nop = Log.nopLogger

    # Default request type if not specified.
    DEFAULT_TYPE: "request"

    # Nop middleware.
    #
    @middlewareNop: ->
      (req, res, next) ->
        res.locals._log = Log.nopLogger
        next()

    # Middleware.
    #
    @middleware: (opts = {}) ->
      (req, res, next) ->
        # Create logger.
        log = new Log opts
        log.addReq req

        # Attach to request.
        res.locals._log = log

        # Proxy end (what connect.logger does).
        _end = res.end
        res.end = (chunk, encoding) ->
          res.end = _end
          res.end(chunk, encoding)

          # Allow controllers to wipe out the object.
          return unless res.locals._log

          level = "info"
          if 400 <= res.statusCode < 500
            level = "warning"
          if res.statusCode >= 500
            level = "error"

          log.addRes res
          log[level] "request"

        next()

    # Add request to instance meta.
    addReq: (req = {}) ->
      maxChars    = 200
      urlObj      = url.parse req?.url
      path        = urlObj?.pathname
      query       = urlObj?.query ? ""
      queryChars  = query?.length
      path        = path.substr  0, maxChars if path.length > maxChars
      query       = query.substr 0, maxChars if queryChars > maxChars

      @meta = extend @meta, stripNulls({
        reqClient:      clientIp req
        reqHost:        req?.headers?.host ? null
        reqMethod:      req?.method ? null
        reqPath:        path
        reqQuery:       query
        reqQueryChars:  queryChars
        reqUser:        req?.user?.email ? null
      })

    addRes: (res = {}) ->
      @meta = extend @meta,
        resStatus:      res.statusCode

    # Add error to instance meta.
    addError: (error = "unknown") ->
      errObj = errMsg: error?.message ? error.toString()

      unless @errNoStack
        extend errObj, stripNulls({
          errArgs:  (error?.arguments ? "").toString().substr(0, 100)
          errType:  error?.type ? null
          errStack: error?.stack ? null
          errKnown: 0
        })

      @meta = extend @meta, errObj

    # Modify and aggregate list of metas.
    #
    @aggregateMeta: (metas...) =>
      @patchMeta.apply @, [ {} ].concat(metas)

    # Modify and aggregate list of metas.
    #
    @patchMeta: (metas...) =>
      # Filter the metas
      metas = (m for m in metas when m?)

      # Get first to operate on.
      obj = if metas.length > 0 then metas[0] else {}

      # Patch first with others.
      for meta in metas[1..]
        for own key, value of meta
          if typeof value is "number"
            # Number.
            obj[key] = (obj[key] ? 0) + value

          else if value?.concat?
            # Array-like object.
            obj[key] = [] unless obj[key]?
            obj[key] = obj[key].concat(value)

          else
            obj[key] = value

      obj

    # Create base meta for additions.
    #
    baseMeta: (meta = {}, level = null) =>
      extend {
        date:       (new Date()).toISOString()
        level:      level or meta.level
        env:        process.env.NODE_ENV
        type:       meta?.type ? @DEFAULT_TYPE
        serverHost: HOST_NAME
        serverId:   WORKER_ID
        serverPid:  process.pid
      }, classMeta, meta

    # Create a final meta object, merging base, constructed, incoming.
    #
    _makeMeta: (level, meta = {}) ->
      # Store type of of meta first.
      type = meta.type ? @meta.type ? @type ? @DEFAULT_TYPE

      # Create full meta object, then override type.
      meta = extend @baseMeta(null, level), @meta, meta
      meta.type = type

      # Return finished object.
      meta

    # Dynamically add in the actual log methods (wrapping Winston).
    for level in Object.keys winstonLogger.levels
      # Need to wrap the invocation for safety / jshint.
      do (level) =>
        @::[level] = (msg, metaOrCb = {}, cb = null) ->
          # Params: 2nd, 3rd arguments switch for Winston. Parse out.
          if cb?
            meta      = metaOrCb ? {}
            callback  = cb
          else if metaOrCb?
            meta      = if typeof metaOrCb is "object"   then metaOrCb else {}
            callback  = if typeof metaOrCb is "function" then metaOrCb else null

          # Create final meta.
          meta = @_makeMeta level, meta

          # Call the real logger.
          winstonLogger[meta.level].apply Log, [msg, meta, callback]

    @nopLogger: do ->
      obj = {}
      for level in Object.keys winstonLogger.levels
        do (level) ->
          obj[level] = ->

      obj

  # Set internal logger.
  _Log = Log

  # Explicitly return created class.
  Log

module.exports =
  Handlers: Handlers
  factory:  factory
