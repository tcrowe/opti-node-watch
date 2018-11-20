/*

# opti-node-watch msg

+ format whatever comes out of stdout or stderr

See ../../COPYING for GPL 3.0 license

*/

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
