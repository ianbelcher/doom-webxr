/* eslint-disable no-console, import/no-dynamic-require */
const { DIRECTORIES } = require('../../configuration');

const helpers = require(`${DIRECTORIES.library}/helpers`);

module.exports = (level) => {
  const {
    vertexes, linedefs, sidedefs, sectors,
  } = level;
  const { scaled, isSky } = helpers(level);

  const planes = linedefs.reduce((accumulator, lineDef) => {
    // Need width, height, x, y, z and rotation for each plane
    const {
      leftSidedef: leftSideDefIndex, rightSidedef: rightSideDefIndex, startVertex, endVertex,
    } = lineDef;
    const startPoint = vertexes[startVertex];
    const endPoint = vertexes[endVertex];
    const leftSideDef = leftSideDefIndex > -1 ? sidedefs[leftSideDefIndex] : false;
    const rightSideDef = rightSideDefIndex > -1 ? sidedefs[rightSideDefIndex] : false;
    const leftSideSector = leftSideDef ? sectors[leftSideDef.sector] : false;
    const rightSideSector = rightSideDef ? sectors[rightSideDef.sector] : false;
    // y movement
    const rise = endPoint.y - startPoint.y;
    // x movement
    const run = endPoint.x - startPoint.x;
    // https://math.stackexchange.com/a/2587852
    const rightSideRotation = Math.atan2(rise, run);
    // The inverse angle of the rightSideRotation
    const leftSideRotation = Math.atan2(-1 * rise, -1 * run);
    const plane = {
      width: scaled(Math.sqrt((rise ** 2) + (run ** 2))), // Distance / pythagoras
      x: scaled((startPoint.x + endPoint.x) / 2, 'x'), // Middle
      z: scaled((startPoint.y + endPoint.y) / 2, 'z'), // Middle
    };

    if (leftSideDef && leftSideDef.middle !== '-') {
      accumulator.push({
        ...plane,
        y: scaled((leftSideSector.ceilingHeight + leftSideSector.floorHeight) / 2, 'y'),
        height: scaled(leftSideSector.ceilingHeight - leftSideSector.floorHeight, 'y'),
        rotation: leftSideRotation,
        src: leftSideDef.middle.toUpperCase(),
      });
    }
    if (leftSideDef && leftSideDef.upper !== '-' && (rightSideSector ? !isSky(rightSideSector) : true)) {
      accumulator.push({
        ...plane,
        y: scaled((leftSideSector.ceilingHeight + rightSideSector.ceilingHeight) / 2, 'y'),
        height: scaled(leftSideSector.ceilingHeight - rightSideSector.ceilingHeight, 'y'),
        rotation: leftSideRotation,
        src: leftSideDef.upper.toUpperCase(),
      });
    }
    if (leftSideDef && leftSideDef.lower !== '-') {
      accumulator.push({
        ...plane,
        y: scaled((rightSideSector.floorHeight + leftSideSector.floorHeight) / 2, 'y'),
        height: scaled(rightSideSector.floorHeight - leftSideSector.floorHeight, 'y'),
        rotation: leftSideRotation,
        src: leftSideDef.lower.toUpperCase(),
      });
    }

    if (rightSideDef && rightSideDef.middle !== '-') {
      accumulator.push({
        ...plane,
        y: scaled((rightSideSector.ceilingHeight + rightSideSector.floorHeight) / 2, 'y'),
        height: scaled(rightSideSector.ceilingHeight - rightSideSector.floorHeight, 'y'),
        rotation: rightSideRotation,
        src: rightSideDef.middle.toUpperCase(),
      });
    }
    if (rightSideDef && rightSideDef.upper !== '-' && (leftSideSector ? !isSky(leftSideSector) : true)) {
      accumulator.push({
        ...plane,
        y: scaled((rightSideSector.ceilingHeight + leftSideSector.ceilingHeight) / 2, 'y'),
        height: scaled(rightSideSector.ceilingHeight - leftSideSector.ceilingHeight, 'y'),
        rotation: rightSideRotation,
        src: rightSideDef.upper.toUpperCase(),
      });
    }
    if (rightSideDef && rightSideDef.lower !== '-') {
      accumulator.push({
        ...plane,
        y: scaled((leftSideSector.floorHeight + rightSideSector.floorHeight) / 2, 'y'),
        height: scaled(leftSideSector.floorHeight - rightSideSector.floorHeight, 'y'),
        rotation: rightSideRotation,
        src: rightSideDef.lower.toUpperCase(),
      });
    }

    return accumulator;
  }, [])
    .filter(i => i.height > 0.0001);

  return planes;
};
