/* eslint-disable no-console, import/no-dynamic-require */

const { DIRECTORIES, SIZE_FACTOR } = require('../../configuration');

const imageSizesResolver = require(`${DIRECTORIES.library}/image-sizes`);
const { renderFile, writeFile } = require(`${DIRECTORIES.library}/io`);
const parsePolygons = require('./parse-polygons');
const parseSkyNumber = require('./parse-sky-number');
const parsePlanes = require('./parse-planes');
const parseStartPosition = require('./parse-start-position');
const parseThings = require('./parse-things');

module.exports = async (level) => {
  // Ensure image sizes is resolved prior to moving forward, need to fix this.
  const imageSizes = await imageSizesResolver;
  console.log(`Building ${level.name}`);

  // Required for sprites and startPosition
  const polygons = await parsePolygons(level);

  const html = await renderFile(
    `${DIRECTORIES.template}/map.ejs`,
    {
      name: level.name,
      imageSizes,
      SIZE_FACTOR,
      polygons,
      skyNumber: await parseSkyNumber(level),
      planes: await parsePlanes(level),
      sprites: await parseThings(level, polygons),
      startPosition: await parseStartPosition(level, polygons),
    },
    {},
  );

  await writeFile(`${DIRECTORIES.public}/${level.name}.html`, html);
};
