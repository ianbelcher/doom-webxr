const { readFile: readFileCb, writeFile: writeFileCb, readdir: readdirCb } = require('fs');
const { promisify } = require('util');
const sizeOf = promisify(require('image-size'));

const readFile = promisify(readFileCb);
const writeFile = promisify(writeFileCb);
const readdir = promisify(readdirCb);
const sizes = {};

const main = async () => {
  try {

    const files = await readdir('/web/assets');
    const promises = files.map(async file => (
      new Promise(async (res, rej) => {
        if (file.indexOf('.png') !== -1) {
          const { width, height } = await sizeOf(`/web/assets/${file}`);
          sizes[file.replace('.png', '')] = { width, height };
          return res();
        }
        return res();
      })
    ));

    await Promise.all(promises);

    await writeFile('./sizes.json', JSON.stringify(sizes));

  } catch (error) {
    console.error(error);
    process.exit();
  }
}

main();
