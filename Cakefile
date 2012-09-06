async   = require "async"
cakepop = require "cakepop"
utils   = cakepop.utils
builder = new cakepop.CoffeeBuild()
style   = new cakepop.Style
  coffee:
    config: "dev/coffeelint.json"
  js:
    config: "dev/jshint.json"

CS_SOURCE = [
  "Cakefile"
  "winex.coffee"
]

CS_BUILD = [
  "winex.coffee"
]

JS_SOURCE = [
  "winex.js"
]

task "prepublish", "Run everything to get ready for publish.", ->
  async.series [
    (cb) -> style.coffeelint CS_SOURCE, cb
    (cb) -> builder.build CS_BUILD, cb
    (cb) -> style.jshint JS_SOURCE, cb
  ], (err) ->
    utils.fail err if err
    utils.print "\nPrepublish finished successfully".info

task "dev:coffeelint", "Run CoffeeScript style checks.", ->
  style.coffeelint CS_SOURCE

task "dev:jshint", "Run JavaScript style checks.", ->
  style.jshint JS_SOURCE

task "source:build", "Build CoffeeScript to JavaScript.", ->
  builder.build CS_BUILD

task "source:watch", "Watch (build) CoffeeScript to JavaScript.", ->
  builder.watch CS_BUILD
