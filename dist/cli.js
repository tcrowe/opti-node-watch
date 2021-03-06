#!/usr/bin/env opti-node
"use strict";

var minimist = require("minimist");

var isArray = require("lodash/isArray");

var isNumber = require("lodash/isNumber");

var isFinite = require("lodash/isFinite");

var isString = require("lodash/isString");

var isNil = require("lodash/isNil");

var _require = require("."),
    createWatcher = _require.createWatcher;

var msg = require("./lib/msg");

var args = minimist(process.argv);
var w = args.w,
    watch = args.watch,
    ext = args.ext,
    d = args.d,
    delay = args.delay,
    exec = args.exec,
    script = args.script,
    help = args.help,
    debug = args.debug;
var watcherOpts = {
  watchPatterns: [],
  restartDelay: 0,
  extensions: ["js", "jsx", "json"],
  exec: "",
  script: "",
  debug: false
};

if (isNil(help) === false) {
  console.log("\n  opti-node-watch\n\n  Watch these directories or files. (required, no default)\n  -w dist/client\n  --watch dist/server\n  -w dist/shared\n  -w dist/index.js\n  --watch package.json\n\n  ---\n\n  Extensions: (optional, default: js,jsx,json)\n  --ext js,jsx,ts,tsx,json\n\n  Use of --ext is comma-separated without spaces.\n\n  ---\n\n  Reload delay in milliseconds: (optional)\n  -d 1000\n  --delay 1000\n\n  ---\n\n  Command to execute: (optional, default: opti-node)\n  --exec node\n  --exec python\n\n  ---\n\n  Which script to run: (required, no default)\n  --script dist/index.js\n\n  ---\n\n  Debug, show which events happen:\n  --debug\n\n  ---\n\n  Help:\n  --help\n  ");
  process.exit();
}

if (isString(w) === true) {
  watcherOpts.watchPatterns.push(w);
}

if (isArray(w) === true) {
  watcherOpts.watchPatterns = watcherOpts.watchPatterns.concat(w);
}

if (isString(watch) === true) {
  watcherOpts.watchPatterns.push(watch);
}

if (isArray(watch) === true) {
  watcherOpts.watchPatterns = watcherOpts.watchPatterns.concat(watch);
}

if (isString(ext) === true) {
  ext.split(",").forEach(function (item) {
    return watcherOpts.extensions.push(item);
  });
}

if (isArray(ext) === true) {
  watcherOpts.extensions = watcherOpts.extensions.concat(ext);
}

if (isNumber(d) === true && isFinite(d) === true) {
  watcherOpts.restartDelay = d;
}

if (isNumber(delay) === true && isFinite(delay) === true) {
  watcherOpts.restartDelay = delay;
}

if (isString(exec) === true) {
  var execFound = false;
  watcherOpts.exec = process.argv.reduce(function (op, arg) {
    if (execFound === true) {
      return "".concat(op, " ").concat(arg);
    }

    if (arg === "--exec") {
      execFound = true;
    }

    return op;
  }, "").trim();
}

if (isString(script) === true) {
  watcherOpts.script = script;
}

if (debug === true) {
  watcherOpts.debug = debug;
}

var watcher = createWatcher(watcherOpts);
watcher.addListener("error", function (err) {
  process.stderr.write(msg("error", err));
});
watcher.addListener("change", function (evt) {
  if (debug === true) {
    process.stdout.write(msg("change", evt));
  }
});
watcher.addListener("proc-error", function (err) {
  process.stderr.write(msg("proc-error", err));
});
watcher.addListener("proc-disconnect", function (err) {
  if (debug === true) {
    process.stdout.write(msg("proc-disconnect", err));
  }
});
watcher.addListener("proc-close", function (err) {
  if (debug === true) {
    process.stdout.write(msg("proc-close", err));
  }
});
watcher.addListener("proc-exit", function (err) {
  if (debug === true) {
    process.stdout.write(msg("proc-exit", err));
  }
});
watcher.stdout.pipe(process.stdout);
watcher.stderr.pipe(process.stderr);
watcher.addListener("started", function () {
  if (debug === true) {
    process.stdout.write(msg("started"));
  }
});
watcher.start();
//# sourceMappingURL=cli.js.map