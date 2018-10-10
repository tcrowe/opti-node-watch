"use strict";

var flagPattern = /^-{1,2}([a-z]{1,10})/;

function parseOpts(argv, keyMap) {
  var argvLen = argv.length;
  var op = {};

  for (var i = 0; i < argv.length; i += 1) {
    var item = argv[i];
    var matches = void 0;

    if (item === undefined) {
      break;
    }

    matches = flagPattern.exec(item);

    if (matches !== null) {}
  }

  return op;
}

module.exports = parseOpts;
//# sourceMappingURL=parse-opts.js.map