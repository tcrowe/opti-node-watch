"use strict";

function _toArray(arr) { return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var fs = require("fs");

var path = require("path");

var assert = require("assert");

var _require = require("events"),
    EventEmitter = _require.EventEmitter;

var _require2 = require("child_process"),
    spawn = _require2.spawn;

var async = require("async");

var micromatch = require("micromatch");

var isArray = require("lodash/isArray");

var isString = require("lodash/isString");

var isNumber = require("lodash/isNumber");

var isFinite = require("lodash/isFinite");

var isNil = require("lodash/isNil");

var flatten = require("lodash/flatten");

var debounce = require("lodash/debounce");

var through = require("through");

var _require3 = require("opti-node"),
    createProcess = _require3.createProcess;

var _process$env$NODE_ENV = process.env.NODE_ENV,
    NODE_ENV = _process$env$NODE_ENV === void 0 ? "development" : _process$env$NODE_ENV;
var cwd = process.cwd();
var chalk;
var unixRoot = "/";
var windowsRootPattern = /^[A-Z]:\\\\/;
var lineBreakPattern = /\n/;
var internalErrorPatterns = ["internal/modules/cjs/loader.js", "internal/bootstrap/node.js"];
var colorErrorPatterns = [/[a-z]{3,10}?Error/gim];
var urlPatterns = [/(?!:\()\/.+(?=\))/gim];
var leadingQuotesPattern = /^("|')/;
var trailingQuotesPattern = /("|')$/;

var isAbsolutePath = function isAbsolutePath(str) {
  return str.startsWith(unixRoot) === true || windowsRootPattern.test(str) === true;
};

var statList = function statList(absolutePaths) {
  return function (done) {
    return async.map(absolutePaths, fs.stat, done);
  };
};

var hasNoInternalErrors = function hasNoInternalErrors(stdLine) {
  return internalErrorPatterns.every(function (pattern) {
    if (isString(pattern) === true) {
      return stdLine.indexOf(pattern) === -1;
    }

    if (pattern.constructor === RegExp) {
      return pattern.test(stdLine) === false;
    }

    throw new Error("internalErrorPatterns has a bad element");
  }) === true;
};

function colorErrors(stdLine) {
  if (chalk === undefined) {
    chalk = require("chalk");
  }

  return colorErrorPatterns.reduce(function (op, pattern) {
    var matches = pattern.exec(op);

    if (matches !== null && matches.length > 0) {
      op = op.replace(pattern, chalk.red(matches[0]));
    }

    return op;
  }, stdLine);
}

function colorUrls(stdLine) {
  if (chalk === undefined) {
    chalk = require("chalk");
  }

  return urlPatterns.reduce(function (op, pattern) {
    var matches = pattern.exec(op);

    if (matches !== null && matches.length > 0) {
      op = op.replace(pattern, chalk.bgHex("#000000").hex("#EEEEEE").underline(matches[0]));
    }

    return op;
  }, stdLine);
}

var formatErrors = function formatErrors(chunk) {
  return chunk.toString().split(lineBreakPattern).filter(hasNoInternalErrors).map(colorErrors).map(colorUrls).join("\n");
};

function createWatcher(opts) {
  var _opts$watchPatterns = opts.watchPatterns,
      watchPatterns = _opts$watchPatterns === void 0 ? [] : _opts$watchPatterns,
      _opts$restartDelay = opts.restartDelay,
      restartDelay = _opts$restartDelay === void 0 ? 0 : _opts$restartDelay,
      _opts$extensions = opts.extensions,
      extensions = _opts$extensions === void 0 ? ["js", "jsx", "json"] : _opts$extensions,
      _opts$exec = opts.exec,
      exec = _opts$exec === void 0 ? "" : _opts$exec,
      _opts$script = opts.script,
      script = _opts$script === void 0 ? "" : _opts$script;
  assert(isArray(watchPatterns) === true, "watchPatterns is an array");
  assert(watchPatterns.every(function (item) {
    return isString(item) === true;
  }) === true, "watchPatterns is an array of strings");
  assert(extensions.every(function (item) {
    return isString(item) === true;
  }) === true, "extensions is an array of strings");
  assert(isNumber(restartDelay) === true, "restartDelay is a number");
  assert(isFinite(restartDelay) === true, "restartDelay is a finite number");
  assert(isString(exec) === true, "exec is a string");
  assert(isString(script) === true, "script is a string");
  assert(exec.length === 0 || script.length === 0, "you can use exec or script, but not both");
  var watcher = new EventEmitter();
  var globPatterns = extensions.map(function (item) {
    return "*.".concat(item);
  });
  watcher.fsWatchers = [];

  function write(chunk) {
    this.queue(chunk);
  }

  var errorChunks = [];
  var errorTimer;

  function writeError(chunk) {
    var _this = this;

    if (NODE_ENV === "production") {
      return this.queue(chunk);
    }

    clearTimeout(errorTimer);
    errorChunks.push(chunk.toString());
    errorTimer = setTimeout(function () {
      _this.queue(formatErrors(errorChunks.join("")));
    }, 10);
  }

  function end() {
    var chunk = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
    this.queue(chunk);
  }

  watcher.stdout = through(write, end, {
    autoDestroy: false
  });
  watcher.stderr = through(writeError, end, {
    autoDestroy: false
  });
  var absolutePaths = [].concat(flatten(watchPatterns)).map(function (item) {
    if (isAbsolutePath(item) === true) {
      return item;
    }

    return path.join(cwd, item);
  }).map(function (item) {
    return path.resolve(item);
  });
  var proc;

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

    var _process = process,
        env = _process.env;
    var opts = {
      env: env
    };
    var args = [];
    var cmd;

    if (exec === "") {
      args.push(script);
    }

    if (exec !== "") {
      var _exec$trim$replace$re = exec.trim().replace(leadingQuotesPattern, "").replace(trailingQuotesPattern).split(" "),
          _exec$trim$replace$re2 = _toArray(_exec$trim$replace$re),
          execCmd = _exec$trim$replace$re2[0],
          execArgs = _exec$trim$replace$re2.slice(1);

      cmd = execCmd;
      execArgs.forEach(function (item) {
        return args.push(item);
      });
    }

    if (isNil(cmd) === false) {
      proc = spawn(cmd, args, opts);
    } else {
      var optiNodeOpts = {
        args: args,
        opts: opts
      };
      optiNodeOpts.cmd = cmd;
      proc = createProcess(optiNodeOpts);
    }

    proc.addListener("close", function () {
      return watcher.emit("proc-close");
    });
    proc.addListener("disconnect", function () {
      return watcher.emit("proc-disconnect");
    });
    proc.addListener("error", function (err) {
      return watcher.emit("proc-error", err);
    });
    proc.addListener("exit", function () {
      return watcher.emit("proc-exit");
    });
    proc.stdout.pipe(watcher.stdout);
    proc.stderr.pipe(watcher.stderr);
  }

  var restart = debounce(respawn, restartDelay);

  var fsWatcherChange = function fsWatcherChange(fsWatcher) {
    return function (evtType, filename) {
      var path = fsWatcher.path;
      var matches = micromatch(filename, globPatterns);

      if (isNil(matches) === false && matches.length > 0) {
        watcher.emit("change", {
          path: path,
          evtType: evtType,
          filename: filename
        });
        restart();
      }
    };
  };

  var fsWatcherClose = function fsWatcherClose(fsWatcher) {
    return function () {
      var path = fsWatcher.path;
      watcher.emit("close", {
        path: path
      });
    };
  };

  var fsWatcherError = function fsWatcherError() {
    return function (err) {
      err.watcherHelp = "fs watcher error";
      watcher.emit("error", err);
    };
  };

  var createWatchers = function createWatchers(_ref, done) {
    var stats = _ref.stats;
    return done(null, stats.map(function (item, index) {
      var path = absolutePaths[index];
      var watcher = fs.watch(path);
      watcher.path = path;
      watcher.stat = item;
      return watcher;
    }));
  };

  var watcherEvents = function watcherEvents(_ref2, done) {
    var watchers = _ref2.watchers;
    watchers.forEach(function (fsWatcher) {
      fsWatcher.addListener("change", fsWatcherChange(fsWatcher));
      fsWatcher.addListener("close", fsWatcherClose(fsWatcher));
      fsWatcher.addListener("error", fsWatcherError(fsWatcher));
    });
    done();
  };

  watcher.stop = function () {
    watcher.fsWatchers.forEach(function (item) {
      try {
        item.removeAllListeners();
        item.close();
      } catch (error) {
        error.watcherHelp = "error while stopping watcher";
        watcher.emit("error", error);
      }
    });
  };

  watcher.watchPaths = function () {
    var steps = {
      stats: statList(absolutePaths),
      watchers: ["stats", createWatchers],
      watcherEvents: ["watchers", watcherEvents]
    };
    async.auto(steps, function (err) {
      if (isNil(err) === false) {
        err.watcherHelp = "error while setting up watchers";
        return watcher.emit("error", err);
      }

      watcher.emit("started");
      respawn();
    });
  };

  watcher.start = function () {
    watcher.watchPaths();
  };

  return watcher;
}

module.exports = {
  createWatcher: createWatcher
};
//# sourceMappingURL=index.js.map