// This is a development build task script so...
// extraneous deps are ok
// console statements are ok
// Dynamic imports are ok
/* eslint-disable import/no-extraneous-dependencies, import/no-dynamic-require */
const { readWad, createObjectModel } = require('@nrkn/wad');

const { DIRECTORIES } = require('../src/configuration');

const { readFile } = require(`${DIRECTORIES.library}/io`);
const BuildLevel = require(`${DIRECTORIES.library}/build-level`);

const main = async () => {
  try {
    const wadData = await readFile(`${DIRECTORIES.assets}/doom.wad`);
    const wad = readWad(wadData);
    const doomObjectModel = createObjectModel(wad);
    const { levels /* textures, patches etc */ } = doomObjectModel;

    for (let i = 0, max = levels.length; i < max; i += 1) {
      /* eslint-disable-next-line no-await-in-loop */
      await BuildLevel(levels[i]);
    }
    // levels.forEach(BuildLevel);
  } catch (error) {
    /* eslint-disable-next-line no-console */
    console.error(error);
    process.exit();
  }
};

main();
