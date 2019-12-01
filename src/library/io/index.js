/* eslint-disable import/no-extraneous-dependencies */
const { readFile: readFileCb, writeFile: writeFileCb } = require('fs');
const { promisify } = require('util');
const { renderFile: renderFileCb } = require('ejs');

const readFile = promisify(readFileCb);
const writeFile = promisify(writeFileCb);
const renderFile = promisify(renderFileCb);

module.exports = {
  readFile,
  writeFile,
  renderFile,
};
