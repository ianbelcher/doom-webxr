const { resolve } = require('path');

const DIRECTORIES = {
  assets: resolve(__dirname, '../src/static/assets'),
  template: resolve(__dirname, '../src/template'),
  public: resolve(__dirname, '../public'),
  library: resolve(__dirname, '../src/library'),
};

const SIZE_FACTOR = 0.0625;

module.exports = {
  DIRECTORIES,
  SIZE_FACTOR,
};
