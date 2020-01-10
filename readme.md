
# opti-node-watch

Run [opti-node](/tcrowe/opti-node) in development with automatic restart.

The idea is to minimize how much system resources node uses and provide a lighter alternative to [nodemon](/remy/nodemon).

## CLI Usage

Simply `opti-node-watch -w dist -d 500 --script dist/index.js`

All flags

```
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
```

## Programmatic usage in JS

```js
const path = require('path')
const { createWatcher } = require("opti-node-watch")
const distPath = path.join(__dirname, "dist")
const indexPath = path.join(distPath, "index.js")

const watcher = createWatcher({
  watchPatterns: [distPath],
  script: indexPath
});

watcher.addListener("error", err => {
  console.log("opti-node-watch error", err)
});

watcher.addListener("change", evt => {
  const { path, evtType, filename } = evt
  console.log("opti-node-watch change")
  console.log('path', path)
  console.log('evtType', evtType)
  console.log('filename', filename)
});

// pipe to the process
watcher.stdout.pipe(process.stdout);
watcher.stderr.pipe(process.stderr);

watcher.addListener("started", () => console.log("opti-node-watch started"));

watcher.start();
```

`createWatcher(options)`

options:

+ watchPatterns, `string[]`, required, no default
+ restartDelay, `number`, optional, default `0`
+ extensions, `string[]`, optional, default `["js", "jsx", "json"]`
+ exec, `string`, a command to execute
+ script, `string`, the node script

## Development

```sh
# create dev build
npm run dev

# create production build
npm run prd
```

Please run `npm run prd` before commit! Thanks

## Differences from nodemon

I'm sure this has been done a million times now. There were certain aspects of nodemon which were inconvenient to my development process or it simply wouldn't work. I also wanted to see if I can run this with [opti-node](/tcrowe/opti-node).

+ Does not use [chokidar](/paulmillr/chokidar)
+ No json file config e.g. `nodemon.json`
+ No `-e` flag for extensions
+ No ignore yet
+ Less options for polling types
+ No triggering other events
+ Less ecosystem around it

## Copying, license, and contributing

Copyright (C) Tony Crowe 2020 <https://tcrowe.github.io/contact/>

Thank you for using and contributing to make opti-node-watch better.

⚠️ Please run `npm run prd` before submitting a patch.

⚖️ opti-node-watch is Free Software protected by the GPL 3.0 license. See [./COPYING](./COPYING) for more information. (free as in freedom)
