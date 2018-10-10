const isObject = require("lodash/isObject");
const isArray = require("lodash/isArray");
const appKey = "opti-node-watch";

function msg() {
  return [appKey, ...arguments, "\n"]
    .map(item => {
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
    })
    .join(" ");
}

module.exports = msg;
