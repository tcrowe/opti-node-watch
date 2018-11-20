/*

See ../COPYING for GPL 3.0 license

*/

const fs = require("fs");
const path = require("path");
const isNil = require("lodash/isNil");
const { createWatcher } = require("../src");
const tmpPath = path.join(__dirname, "..", ".tmp");
const indexPath = path.join(tmpPath, "index.js");
const indexMessage = "okokok";
const indexSource = `console.log('${indexMessage}')`;

describe("opti-node-watch", () => {
  it("createWatcher initializes", () => {
    const watcher = createWatcher({
      watchPatterns: [tmpPath],
      script: ""
    });
    watcher.stop.should.be.a.Function;
    watcher.watchPaths.should.be.a.Function;
    watcher.start.should.be.a.Function;
  });

  it("start", done => {
    const writeIndex = () =>
      fs.writeFile(indexPath, indexSource, err => {
        if (isNil(err) === false) {
          throw err;
        }
      });

    const watcher = createWatcher({
      watchPatterns: [tmpPath],
      script: indexPath
    });

    watcher.addListener("error", err => {
      // this should not be reached but just in case
      throw err;
    });

    watcher.addListener("change", evt => {
      evt.should.be.an.Object;
      evt.path.should.be.exactly(tmpPath);
      ["change", "rename"].should.matchAny(evt.evtType);
      evt.filename.should.be.exactly("index.js");
      setTimeout(done, 200);
    });

    watcher.addListener("proc-stdout-data", buf => {
      buf.toString().should.be.exactly(indexMessage + "\n");
    });

    watcher.addListener("proc-stderr-data", buf => {
      // this path should not be reached
      throw new Error(buf.toString());
    });

    watcher.addListener("started", () => writeIndex());

    watcher.start();
  });
});
