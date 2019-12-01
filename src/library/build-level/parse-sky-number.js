/* eslint-disable no-console, import/no-dynamic-require */
const { DIRECTORIES } = require('../../configuration');

const helpers = require(`${DIRECTORIES.library}/helpers`);

module.exports = (level) => {
  const {
    linedefs, sidedefs, sectors,
  } = level;
  const { isSky } = helpers(level);

  let skyNumber = 1;
  linedefs.forEach((lineDef) => {
    const {
      leftSidedef: leftSideDefIndex, rightSidedef: rightSideDefIndex,
    } = lineDef;
    const leftSideDef = leftSideDefIndex ? sidedefs[leftSideDefIndex] : false;
    const rightSideDef = rightSideDefIndex ? sidedefs[rightSideDefIndex] : false;
    const leftSideSector = leftSideDef ? sectors[leftSideDef.sector] : false;
    const rightSideSector = rightSideDef ? sectors[rightSideDef.sector] : false;

    if (isSky(leftSideSector)) {
      skyNumber = leftSideSector.ceiling.replace('F_SKY', '').replace('SKY', '');
    }
    if (isSky(rightSideSector)) {
      skyNumber = rightSideSector.ceiling.replace('F_SKY', '').replace('SKY', '');
    }
  });

  return skyNumber;
};
