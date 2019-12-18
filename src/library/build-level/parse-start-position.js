/* eslint-disable no-console, import/no-dynamic-require */
const { DIRECTORIES } = require('../../configuration');

const helpers = require(`${DIRECTORIES.library}/helpers`);

module.exports = async (level, polygons) => {
  const { things } = level;
  const { scaled, getSectorForPointFactory } = helpers(level);
  const startPositionThing = things
    .find(({ type }) => type === 1);
  const {
    x, y, angle,
  } = startPositionThing;
  const getSectorForPoint = getSectorForPointFactory(polygons);
  const sector = getSectorForPoint(scaled(x, 'x'), scaled(y, 'z'));
  return {
    x: scaled(x, 'x'),
    y: sector ? sector.floorHeight + 0.1 : 0,
    z: scaled(y, 'z'),
    angle: angle * (Math.PI / 180),
  };

};
