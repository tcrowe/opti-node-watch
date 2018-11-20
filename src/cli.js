#!/usr/bin/env opti-node

/*

opti-node-watch cli app

+ command line interface for opti-node-watch
+ watch files
+ have a delay
+ run a node script with opti-node
+ OR run a custom shell script

API doc in ../readme.md

See  ../COPYING for GPL 3.0 license

*/

const minimist = require("minimist");
const isArray = require("lodash/isArray");
const isNumber = require("lodash/isNumber");
const isFinite = require("lodash/isFinite");
const isString = require("lodash/isString");
const isNil = require("lodash/isNil");
const { createWatcher } = require(".");
const msg = require("./lib/msg");
const args = minimist(process.argv);
const { w, watch, ext, d, delay, exec, script, help, debug } = args;

const watcherOpts = {
  watchPatterns: [],
  restartDelay: 0,
  extensions: ["js", "jsx", "json"],
  exec: "",
  script: "",
  debug: false
};

if (isNil(help) === false) {
  console.log(`
  opti-node-watch

  Watch these directories or files. (required, no default)
  -w dist/client
  --watch dist/server
  -w dist/shared
  -w dist/index.js
  --watch package.json

  ---

  Extensions: (optional, default: js,jsx,json)
  --ext js,jsx,ts,tsx,json

  Use of --ext is comma-separated without spaces.

  ---

  Reload delay in milliseconds: (optional)
  -d 1000
  --delay 1000

  ---

  Command to execute: (optional, default: opti-node)
  --exec node
  --exec python

  ---

  Which script to run: (required, no default)
  --script dist/index.js

  ---

  Debug, show which events happen:
  --debug

  ---

  Help:
  --help
  `);
  process.exit();
}

//
// -w
//

if (isString(w) === true) {
  watcherOpts.watchPatterns.push(w);
}

if (isArray(w) === true) {
  watcherOpts.watchPatterns = watcherOpts.watchPatterns.concat(w);
}

//
// --watch
//
if (isString(watch) === true) {
  watcherOpts.watchPatterns.push(watch);
}

if (isArray(watch) === true) {
  watcherOpts.watchPatterns = watcherOpts.watchPatterns.concat(watch);
}

//
// --ext
//

if (isString(ext) === true) {
  ext.split(",").forEach(item => watcherOpts.extensions.push(item));
}

if (isArray(ext) === true) {
  watcherOpts.extensions = watcherOpts.extensions.concat(ext);
}

//
// -d
//

if (isNumber(d) === true && isFinite(d) === true) {
  watcherOpts.restartDelay = d;
}

//
// --delay
//

if (isNumber(delay) === true && isFinite(delay) === true) {
  watcherOpts.restartDelay = delay;
}

//
// --exec
//

if (isString(exec) === true) {
  // watcherOpts.exec = exec;
  let execFound = false;

  watcherOpts.exec = process.argv
    .reduce((op, arg) => {
      if (execFound === true) {
        return `${op} ${arg}`;
      }

      if (arg === "--exec") {
        execFound = true;
      }

      return op;
    }, "")
    .trim();
}

//
// --script
//

if (isString(script) === true) {
  watcherOpts.script = script;
}

//
// --debug
//

if (debug === true) {
  watcherOpts.debug = debug;
}

const watcher = createWatcher(watcherOpts);

watcher.addListener("error", err => {
  process.stderr.write(msg("error", err));
});

watcher.addListener("change", evt => {
  if (debug === true) {
    process.stdout.write(msg("change", evt));
  }
});

watcher.addListener("proc-error", err => {
  process.stderr.write(msg("proc-error", err));
});

watcher.addListener("proc-disconnect", err => {
  if (debug === true) {
    process.stdout.write(msg("proc-disconnect", err));
  }
});

watcher.addListener("proc-close", err => {
  if (debug === true) {
    process.stdout.write(msg("proc-close", err));
  }
});

watcher.addListener("proc-exit", err => {
  if (debug === true) {
    process.stdout.write(msg("proc-exit", err));
  }
});

watcher.stdout.pipe(process.stdout);
watcher.stderr.pipe(process.stderr);

watcher.addListener("started", () => {
  if (debug === true) {
    process.stdout.write(msg("started"));
  }
});

watcher.start();
