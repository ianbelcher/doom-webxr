const { writeFile: writeFileCb, readdir: readdirCb } = require('fs');
const { resolve } = require('path');
const { promisify } = require('util');
/* eslint-disable-next-line import/no-extraneous-dependencies */
const sizeOfCb = require('image-size');

const sizeOf = promisify(sizeOfCb);
const { DIRECTORIES } = require('../../configuration');

const writeFile = promisify(writeFileCb);
const readdir = promisify(readdirCb);

module.exports = (async () => {
  try {
    const cacheFile = resolve(__dirname, './cache.json');
    let sizes = {};
    try {
      /* eslint-disable-next-line global-require, import/no-dynamic-require */
      sizes = require(cacheFile);
    } catch (error) {
      // We'll assume that there is no file
    }

    const files = await readdir(DIRECTORIES.assets);
    const promises = files.map(async file => (
      new Promise(async (res) => {
        const assetName = file.replace('.png', '');
        if (file.indexOf('.png') !== -1 && !sizes[assetName]) {
          const { width, height } = await sizeOf(`${DIRECTORIES.assets}/${file}`);
          sizes[assetName] = { width, height };
          return res();
        }
        return res();
      })
    ));

    await Promise.all(promises);

    await writeFile(cacheFile, JSON.stringify(sizes));

    return sizes;
  } catch (error) {
    console.error(error);
    return process.exit();
  }
})();
