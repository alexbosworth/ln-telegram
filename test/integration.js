const {join} = require('node:path');
const {readdirSync} = require('node:fs');
const {run} = require('node:test');
const {tap} = require('node:test/reporters');

const asPath = file => join(file.path || file.parentPath, file.name);
const concurrency = 3;
const dirs = ['integration'];
const timeout = 1000 * 60 * 5;

run({
  concurrency,
  files: dirs.flatMap(dir => {
    return readdirSync(join(__dirname, dir), {withFileTypes: true})
      .map(asPath);
  }),
  timeout,
}).compose(tap).pipe(process.stdout);
