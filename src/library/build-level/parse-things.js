/* eslint-disable no-console, import/no-dynamic-require */
const { DIRECTORIES } = require('../../configuration');

const helpers = require(`${DIRECTORIES.library}/helpers`);
const thingLookup = require(`${DIRECTORIES.library}/things`);
const imageSizesResolver = require(`${DIRECTORIES.library}/image-sizes`);

module.exports = async (level, polygons) => {
  // Ensure image sizes is resolved prior to moving forward, need to fix this.
  const imageSizes = await imageSizesResolver;
  const { things } = level;
  const { scaled, getSectorForPointFactory } = helpers(level);
  return things
    .map((thing) => {
      const {
        x, y, type, angle,
      } = thing;
      const getSectorForPoint = getSectorForPointFactory(polygons);
      const thingDefinition = thingLookup.find(i => i[0] === type);
      if (!thingDefinition) return undefined;
      const [id, /* idHex */, /* version */, size, sprite, sequence] = thingDefinition;
      if (['none', 'none1', 'none4', 'none6'].indexOf(sprite) !== -1) return undefined;
      const sector = getSectorForPoint(scaled(x, 'x'), scaled(y, 'z'));
      if (type === 1) {
        // Ignore player starting position
        return undefined;
      }
      if (!sector) {
        console.log(`No sector found for thing ${JSON.stringify(thing)}`);
        return null;
      }
      let src;
      if (sequence === '+') {
        const regex = new RegExp(`^${sprite}.+1`);
        src = Object.keys(imageSizes).filter(asset => regex.exec(asset));
      } else {
        const regex = new RegExp(`^${sprite}[${sequence}]+0`);
        src = Object.keys(imageSizes).filter(asset => regex.exec(asset));
      }

      return {
        id,
        size,
        src,
        x: scaled(x, 'x'),
        y: sector.floorHeight + scaled(imageSizes[src[0].replace('.png', '')].height / 2, 'y'),
        z: scaled(y, 'z'),
        angle: angle * (Math.PI / 180),
      };
    })
    .filter(i => i);
};
