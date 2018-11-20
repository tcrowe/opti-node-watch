/*

opti-node-watch

+ watch files
+ execute node script with opti-node
+ OR run a custom shell script

API doc in ../readme.md

@module opti-node-watch

See ../COPYING for GPL 3.0 license

*/

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { EventEmitter } = require("events");
const { spawn } = require("child_process");
const async = require("async");
const micromatch = require("micromatch");
const isArray = require("lodash/isArray");
const isString = require("lodash/isString");
const isNumber = require("lodash/isNumber");
const isFinite = require("lodash/isFinite");
const isNil = require("lodash/isNil");
const flatten = require("lodash/flatten");
const debounce = require("lodash/debounce");
const through = require("through");
const { createProcess } = require("opti-node");
const { NODE_ENV = "development" } = process.env;
const cwd = process.cwd();

// lazy load chalk later
let chalk;

// try to detect root paths with these
const unixRoot = "/";
const windowsRootPattern = /^[A-Z]:\\\\/;

// patterns to format and colorize the error output
const lineBreakPattern = /\n/;
const internalErrorPatterns = [
  "internal/modules/cjs/loader.js",
  "internal/bootstrap/node.js"
];
const colorErrorPatterns = [/[a-z]{3,10}?Error/gim];
const urlPatterns = [/(?!:\()\/.+(?=\))/gim];
const leadingQuotesPattern = /^("|')/;
const trailingQuotesPattern = /("|')$/;

/**
 * True when a string is likely to be an absolute path
 * @private
 * @method isAbsolutePath
 * @param {string} str
 * @returns {boolean}
 */
const isAbsolutePath = str =>
  str.startsWith(unixRoot) === true || windowsRootPattern.test(str) === true;

/**
 * Stat a bunch of absolute paths. For use as async function.
 * @private
 * @method statList
 * @param {string[]} absolutePaths
 * @returns {function}
 */
const statList = absolutePaths => done =>
  async.map(absolutePaths, fs.stat, done);

/**
 * True if every item in the list does not match any node internal error
 * @private
 * @method hasNoInternalErrors
 * @param {string} stdLine
 * @returns {boolean}
 */
const hasNoInternalErrors = stdLine =>
  internalErrorPatterns.every(pattern => {
    if (isString(pattern) === true) {
      return stdLine.indexOf(pattern) === -1;
    }

    if (pattern.constructor === RegExp) {
      return pattern.test(stdLine) === false;
    }

    throw new Error("internalErrorPatterns has a bad element");
  }) === true;

/**
 * Take a string from stderr and color error types
 * @private
 * @method colorErrors
 * @param {string} stdLine
 * @returns {string}
 */
function colorErrors(stdLine) {
  // lazy load chalk
  if (chalk === undefined) {
    chalk = require("chalk");
  }

  return colorErrorPatterns.reduce((op, pattern) => {
    const matches = pattern.exec(op);

    if (matches !== null && matches.length > 0) {
      op = op.replace(pattern, chalk.red(matches[0]));
    }

    return op;
  }, stdLine);
}

/**
 * Highlight paths and urls in the stderr output
 * @private
 * @method colorUrls
 * @param {string} stdLine
 * @returns {string}
 */
function colorUrls(stdLine) {
  // lazy load chalk
  if (chalk === undefined) {
    chalk = require("chalk");
  }

  return urlPatterns.reduce((op, pattern) => {
    const matches = pattern.exec(op);

    if (matches !== null && matches.length > 0) {
      op = op.replace(
        pattern,
        chalk
          .bgHex("#000000")
          .hex("#EEEEEE")
          .underline(matches[0])
      );
    }

    return op;
  }, stdLine);
}

/**
 * Break up stderr output into an array, colorize, and join back to a string
 * @private
 * @method formatErrors
 * @param {string|buffer} chunk
 * @returns {string}
 */
const formatErrors = chunk =>
  chunk
    .toString()
    .split(lineBreakPattern)
    .filter(hasNoInternalErrors)
    .map(colorErrors)
    .map(colorUrls)
    .join("\n");

/**
 * Create an opti-node-watch object
 * @public
 * @method createWatcher
 * @param {object} opts
 * @param {string[]} opts.watchPatterns list of absolute paths
 * @param {number} [opts.restartDelay=0] how long to wait before restarting
 * @param {string[]} [extensions=js,jsx,json] extensions to watch
 * @param {string} [exec] command to execute
 * @param {string} [script] script to run with opti-node
 * @returns {object}
 */
function createWatcher(opts) {
  const {
    watchPatterns = [],
    restartDelay = 0,
    extensions = ["js", "jsx", "json"],
    exec = "",
    script = ""
  } = opts;

  //
  // strictly validate all the inputs
  //

  assert(isArray(watchPatterns) === true, "watchPatterns is an array");

  assert(
    watchPatterns.every(item => isString(item) === true) === true,
    "watchPatterns is an array of strings"
  );

  assert(
    extensions.every(item => isString(item) === true) === true,
    "extensions is an array of strings"
  );

  assert(isNumber(restartDelay) === true, "restartDelay is a number");

  assert(isFinite(restartDelay) === true, "restartDelay is a finite number");

  assert(isString(exec) === true, "exec is a string");

  assert(isString(script) === true, "script is a string");

  assert(
    exec.length === 0 || script.length === 0,
    "you can use exec or script, but not both"
  );

  const watcher = new EventEmitter();
  const globPatterns = extensions.map(item => `*.${item}`);

  watcher.fsWatchers = [];

  function write(chunk) {
    this.queue(chunk);
  }

  const errorChunks = [];
  let errorTimer;

  /**
   * Used with through module to help us format errors and proxy
   * stderr output
   * @private
   * @method writeError
   * @param {string|buffer} chunk
   */
  function writeError(chunk) {
    // in production give the output as-is
    if (NODE_ENV === "production") {
      return this.queue(chunk);
    }

    clearTimeout(errorTimer);
    errorChunks.push(chunk.toString());
    errorTimer = setTimeout(() => {
      this.queue(formatErrors(errorChunks.join("")));
    }, 10);
  }

  /**
   * For through module end argument. End of stream
   * @private
   * @method end
   * @param {string} [chunk=""]
   */
  function end(chunk = "") {
    this.queue(chunk);
  }

  watcher.stdout = through(write, end, { autoDestroy: false });
  watcher.stderr = through(writeError, end, { autoDestroy: false });

  // unless the user passed absolute paths to watch prefix it with `cwd`
  const absolutePaths = []
    .concat(flatten(watchPatterns))
    .map(item => {
      if (isAbsolutePath(item) === true) {
        return item;
      }

      return path.join(cwd, item);
    })
    .map(item => path.resolve(item));

  let proc;

  /**
   * Restart the child process
   * @private
   * @method respawn
   */
  function respawn() {
    if (isNil(proc) === false) {
      proc.stderr.removeAllListeners();
      proc.stderr.end();
      proc.stderr.unpipe();
      proc.stdout.removeAllListeners();
      proc.stdout.end();
      proc.stdout.unpipe();
      proc.removeAllListeners();
      proc.kill();
    }

    const { env } = process;
    const opts = { env };
    const args = [];
    let cmd;

    // run opti-node
    // e.g. opti-node script.js
    if (exec === "") {
      args.push(script);
    }

    // execute something else
    if (exec !== "") {
      const [execCmd, ...execArgs] = exec
        .trim()
        .replace(leadingQuotesPattern, "")
        .replace(trailingQuotesPattern)
        .split(" ");
      cmd = execCmd;
      execArgs.forEach(item => args.push(item));
    }

    if (isNil(cmd) === false) {
      // not running opti-node
      proc = spawn(cmd, args, opts);
    } else {
      // running with opti-node
      const optiNodeOpts = { args, opts };
      optiNodeOpts.cmd = cmd;
      proc = createProcess(optiNodeOpts);
    }

    proc.addListener("close", () => watcher.emit("proc-close"));
    proc.addListener("disconnect", () => watcher.emit("proc-disconnect"));
    proc.addListener("error", err => watcher.emit("proc-error", err));
    proc.addListener("exit", () => watcher.emit("proc-exit"));
    proc.stdout.pipe(watcher.stdout);
    proc.stderr.pipe(watcher.stderr);
  }

  /**
   * Debounced restart function using delay from the user
   * @private
   * @method restart
   */
  const restart = debounce(respawn, restartDelay);

  /**
   * Event handler for FSWatcher change event
   * @private
   * @method fsWatcherChange
   * @param {object} fsWatcher
   * @returns {function}
   */
  const fsWatcherChange = fsWatcher => (evtType, filename) => {
    const { path } = fsWatcher;
    const matches = micromatch(filename, globPatterns);

    if (isNil(matches) === false && matches.length > 0) {
      watcher.emit("change", { path, evtType, filename });
      restart();
    }
  };

  /**
   * Event handler for FSWatcher close event
   * @private
   * @method fsWatcherClose
   * @param {object} fsWatcher
   * @returns {function}
   */
  const fsWatcherClose = fsWatcher => () => {
    const { path } = fsWatcher;
    watcher.emit("close", { path });
  };

  /**
   * Event handler for FSWatcher error event
   * @private
   * @method fsWatcherError
   * @param {object} fsWatcher
   * @returns {function}
   */
  const fsWatcherError = () => err => {
    err.watcherHelp = "fs watcher error";
    watcher.emit("error", err);
  };

  /**
   * Create FSWatcher objects for each absolute path. Async function
   * @private
   * @method createWatchers
   * @param {object} results
   * @param {object[]} results.stats array of Stat
   * @returns {function}
   */
  const createWatchers = ({ stats }, done) =>
    done(
      null,
      stats.map((item, index) => {
        const path = absolutePaths[index];
        const watcher = fs.watch(path);
        watcher.path = path;
        watcher.stat = item;
        return watcher;
      })
    );

  /**
   * Assign event listeners to all the watchers. Async function
   * @private
   * @method watcherEvents
   * @param {object} results
   * @param {object[]} results.watchers
   * @returns {function}
   */
  const watcherEvents = ({ watchers }, done) => {
    watchers.forEach(fsWatcher => {
      fsWatcher.addListener("change", fsWatcherChange(fsWatcher));
      fsWatcher.addListener("close", fsWatcherClose(fsWatcher));
      fsWatcher.addListener("error", fsWatcherError(fsWatcher));
    });
    done();
  };

  /**
   * Attempt to gracefully shutdown all the watchers
   * @public
   * @method watcher.stop
   */
  watcher.stop = () => {
    watcher.fsWatchers.forEach(item => {
      try {
        item.removeAllListeners();
        item.close();
      } catch (error) {
        error.watcherHelp = "error while stopping watcher";
        watcher.emit("error", error);
      }
    });
  };

  /**
   * Watch the paths provided for changes. Probably doesn't need to be public
   * @public
   * @method watcher.watchPaths
   */
  watcher.watchPaths = () => {
    const steps = {
      stats: statList(absolutePaths),
      watchers: ["stats", createWatchers],
      watcherEvents: ["watchers", watcherEvents]
    };

    async.auto(steps, err => {
      if (isNil(err) === false) {
        err.watcherHelp = "error while setting up watchers";
        return watcher.emit("error", err);
      }

      watcher.emit("started");
      respawn();
    });
  };

  /**
   * Start the watcher. Creates FSWatcher objects and wires up events
   * @method watcher.start
   */
  watcher.start = () => {
    watcher.watchPaths();
  };

  return watcher;
}

module.exports = { createWatcher };
