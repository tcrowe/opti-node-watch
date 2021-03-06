"use strict";

var isObject = require("lodash/isObject");

var isArray = require("lodash/isArray");

var appKey = "opti-node-watch";

function msg() {
  return [appKey].concat(Array.prototype.slice.call(arguments), ["\n"]).map(function (item) {
    if (item === undefined) {
      return "undefined";
    }

    if (item === null) {
      return "null";
    }

    if (isObject(item) === true || isArray(item) === true) {
      return JSON.stringify(item);
    }

    return item.toString();
  }).join(" ");
}

module.exports = msg;
//# sourceMappingURL=msg.js.map