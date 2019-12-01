/* eslint-disable no-console, import/no-dynamic-require */
const { DIRECTORIES } = require('../../configuration');

const helpers = require(`${DIRECTORIES.library}/helpers`);

module.exports = (level) => {
  const {
    vertexes, linedefs, sidedefs, sectors,
  } = level;
  const {
    scaled, isSky, pointIsInPolygon, carveOutOverlappingPolygons,
  } = helpers(level);

  const getSectorPolygonForSectorIndex = (index) => {
    const allSectorLinedefs = sidedefs
      .map(
        (sidedef, sidedefIndex) => ({ ...sidedef, index: sidedefIndex }),
      )
      .filter(
        sidedef => (sidedef.sector === index),
      )
      .reduce((accumulator, sidedef) => {
        const linedefsForThisSidedef = linedefs
          .filter(
            linedef => (
              linedef.rightSidedef === sidedef.index || linedef.leftSidedef === sidedef.index
            ),
          )
          .map(({
            rightSidedef, leftSidedef, startVertex, endVertex,
          }) => {
            const otherSide = rightSidedef === sidedef.index ? leftSidedef : rightSidedef;
            return {
              ...sidedef,
              start: vertexes[startVertex],
              end: vertexes[endVertex],
              otherSector: sidedefs[otherSide] ? sidedefs[otherSide].sector : undefined,
            };
          });

        return [
          ...accumulator,
          ...linedefsForThisSidedef,
        ];
      }, [])
      .filter(linedef => linedef.otherSector !== index);

    const polygonBuckets = [[]];
    while (allSectorLinedefs.length) {
      const polygonBucketIndex = polygonBuckets.length - 1;
      const currentBucket = polygonBuckets[polygonBucketIndex];
      if (!currentBucket.length) {
        // If the current bucket is empty, add the first value as a start (this value hasn't
        // fit in a previous bucket).
        currentBucket.push(allSectorLinedefs.splice(0, 1)[0]);
      } else {
        // Otherwise, find a value in the remaining list that will fit in this bucket.
        const linedefForBucket = allSectorLinedefs.find(
          (linedef1) => {
            const match = currentBucket.find(
              (linedef2) => {
                const { start: { x: xs1, y: ys1 }, end: { x: xe1, y: ye1 } } = linedef1;
                const { start: { x: xs2, y: ys2 }, end: { x: xe2, y: ye2 } } = linedef2;
                return (xs1 === xs2 && ys1 === ys2) // start === start
                  || (xe1 === xe2 && ye1 === ye2) // end === end
                  || (xs1 === xe2 && ys1 === ye2) // start === end
                  || (xe1 === xs2 && ye1 === ys2); // end == start
              },
            );
            return match;
          },
        );
        if (linedefForBucket) {
          // Remove the current linedefForBucket from the list and add it to the current bucket
          currentBucket.push(
            allSectorLinedefs.splice(allSectorLinedefs.indexOf(linedefForBucket), 1)[0],
          );
        } else {
          // Start a new bucket, we don't have any other values which fit in this bucket.
          polygonBuckets.push([]);
        }
      }
    }

    const polygons = polygonBuckets.map((sides) => {
      // Populate the start of the polygon and the next coordinate that we're looking for
      const polygon = [sides[0].start];
      let nextCoordinate = sides[0].end;
      sides.splice(0, 1);
      while (sides.length) {
        // Iterate through the sides and connect them all up together.
        polygon.push(nextCoordinate);
        const nextSidedefStart = sides.find(
          /* eslint-disable-next-line no-loop-func */
          sd => sd.start.x === nextCoordinate.x && sd.start.y === nextCoordinate.y,
        );
        const nextSidedefEnd = sides.find(
          /* eslint-disable-next-line no-loop-func */
          sd => sd.end.x === nextCoordinate.x && sd.end.y === nextCoordinate.y,
        );
        if (nextSidedefStart) {
          // There is a side that starts with the ending coordinate of the last side
          // we observed. Use it as the next one.
          sides.splice(sides.indexOf(nextSidedefStart), 1);
          nextCoordinate = nextSidedefStart.end;
        } else if (nextSidedefEnd) {
          // There is a side that ends with the ending coordinate of the last side
          // we observed. Use it as the next one.
          sides.splice(sides.indexOf(nextSidedefEnd), 1);
          nextCoordinate = nextSidedefEnd.start;
        } else {
          // Looks like we have a figure 8 polygon where the polygon is squeezed down to a
          // width of 0 through a shared vertex See E4M9#S138 as an example. In this case
          // for now, just ignore the remaining part of the sector.
          console.log(`Incomplete polygon... Leaving as we have ${sides.length} sides left.`);
          console.log(`Sides: ${JSON.stringify(sides)}`);
          console.log(`polygon: ${JSON.stringify(polygon)}`);
          break;
        }
      }
      return polygon;
    });

    let polygon;
    if (polygons.length === 1) {
      [polygon] = polygons;
    } else {
      // We've managed to create more than one polygon for this sector, find out which
      // one is the encompassing one.
      polygon = polygons.slice(1).reduce((largest, current) => {
        const nonExclusivePoint = current.find(
          ({ x, y }) => !largest.find(vertex => vertex.x === x && vertex.y === y),
        );
        if (pointIsInPolygon(nonExclusivePoint[0], nonExclusivePoint[1], largest)) {
          return current;
        }
        return largest;
      }, polygons.slice(0, 1)[0]);
    }


    // Ensure all our polygons follow the right hand rule and turn in the same direction.
    // @see https://stackoverflow.com/a/1165943/981598
    let anglesSum = 0;
    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
      // Last entry references the first
      const edgeIndexNext = edgeIndex !== polygon.length - 1 ? edgeIndex + 1 : 0;
      anglesSum += (
        (polygon[edgeIndexNext].x - polygon[edgeIndex].x)
        * (polygon[edgeIndexNext].y + polygon[edgeIndex].y)
      );
    }
    if (anglesSum < 0) {
      polygon.reverse();
    }
    return polygon;
  };

  return sectors
    .map((sector, index) => {
      const polygonRaw = getSectorPolygonForSectorIndex(index);
      const polygon = polygonRaw.map(i => [scaled(i.x, 'x'), scaled(i.y, 'z')]);

      const bounds = polygon.reduce((accumulator, point) => ([
        [
          Math.min(accumulator[0][0], point[0]),
          Math.min(accumulator[0][1], point[1]),
        ],
        [
          Math.max(accumulator[1][0], point[0]),
          Math.max(accumulator[1][1], point[1]),
        ],
      ]), [[Infinity, Infinity], [-Infinity, -Infinity]]);

      return {
        ...sector,
        sectorId: index,
        isSky: isSky(sector),
        floorHeight: scaled(sector.floorHeight),
        ceilingHeight: scaled(sector.ceilingHeight),
        polygon,
        bounds,
      };
    })
    .map(carveOutOverlappingPolygons);
};
