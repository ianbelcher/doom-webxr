// This is a development build task, extraneous deps are ok as are console statements.
/* eslint-disable import/no-extraneous-dependencies, no-console */
const { readFile: readFileCb, writeFile: writeFileCb } = require('fs');
const { resolve } = require('path');
const { promisify } = require('util');

const { readWad, createObjectModel } = require('@nrkn/wad');
const { renderFile: renderFileCb } = require('ejs');

const ImageSizes = require('./library/image-sizes');
const thingLookup = require('./library/things');
const pointIsInPolygon = require('./library/point-is-in-polygon');
const carveOutOverlappingPolygons = require('./library/carve-out-overlapping-polygons');

const readFile = promisify(readFileCb);
const writeFile = promisify(writeFileCb);
const renderFile = promisify(renderFileCb);

const DIRECTORIES = {
  assets: resolve(__dirname, './static/assets'),
  template: resolve(__dirname, './template'),
  public: resolve(__dirname, '../public'),
};

const main = async () => {
  try {
    const imageSizes = await ImageSizes(DIRECTORIES.assets);

    const wadData = await readFile(`${DIRECTORIES.assets}/doom.wad`);
    const wad = readWad(wadData);
    const doomObjectModel = createObjectModel(wad);
    const { levels /* textures, patches etc */ } = doomObjectModel;

    levels.forEach(async (level) => {
      const {
        vertexes, linedefs, sidedefs, sectors, things, name,
      } = level;
      console.log(`Building ${name}`);

      const verticesRanges = vertexes.reduce(
        (c, v) => ({
          xMin: Math.min(c.xMin, v.x),
          yMin: Math.min(c.yMin, v.y),
          xMax: Math.max(c.xMax, v.x),
          yMax: Math.max(c.yMax, v.y),
        }),
        {
          xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity,
        },
      );
      const centerOfMass = {
        x: (verticesRanges.xMax + verticesRanges.xMin) / 2,
        y: 0,
        z: (verticesRanges.yMax + verticesRanges.yMin) / 2,
        none: 0,
      };

      const axisFunction = {
        x: v => v,
        y: v => v,
        z: v => v,
        none: v => v,
      };

      const scale = 0.0625; // The factor we use to size the map coordinates etc.
      const scaled = (number, dimension = 'none') => (scale * axisFunction[dimension](number - centerOfMass[dimension]));
      // const scaled = (number, dimension = 'none') => number;

      const isSky = sector => ['F_SKY1', 'SKY1', 'SKY2', 'SKY3', 'SKY4'].indexOf(sector.ceiling) !== -1;

      // -- Sidedefs look like the following
      // { x: 0,
      //   y: 0,
      //   upper: 'COMPTALL',
      //   lower: 'COMPSPAN',
      //   middle: '-',
      //   sector: 15 }

      // -- Linedefs look like the following
      // { startVertex: 309,
      //   endVertex: 294,
      //   flags:
      //    { impassable: false,
      //      blockMonster: false,
      //      doubleSided: true,
      //      upperUnpegged: true,
      //      lowerUnpegged: false,
      //      secret: false,
      //      blockSound: false,
      //      hidden: false,
      //      shown: false },
      //   specialType: 0,
      //   sectorTag: 0,
      //   rightSidedef: 664,
      //   leftSidedef: 665 }

      // -- Sectors look like the following
      // { floorHeight: 104,
      //   ceilingHeight: 184,
      //   floor: 'FLOOR4_8',
      //   ceiling: 'FLOOR6_2',
      //   light: 128,
      //   type: 9,
      //   tag: 2 }

      let skyNumber = 1;
      const planes = linedefs.reduce((accumulator, lineDef) => {
        // Need width, height, x, y, z and rotation for each plane
        const {
          leftSidedef: leftSideDefIndex, rightSidedef: rightSideDefIndex, startVertex, endVertex,
        } = lineDef;
        const startPoint = vertexes[startVertex];
        const endPoint = vertexes[endVertex];
        const leftSideDef = leftSideDefIndex ? sidedefs[leftSideDefIndex] : false;
        const rightSideDef = rightSideDefIndex ? sidedefs[rightSideDefIndex] : false;
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

        if (isSky(leftSideSector)) {
          skyNumber = leftSideSector.ceiling.replace('F_SKY', '').replace('SKY', '');
        }
        if (isSky(rightSideSector)) {
          skyNumber = rightSideSector.ceiling.replace('F_SKY', '').replace('SKY', '');
        }

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

      const polygons = sectors
        .map((sector, index) => {
          const polygon = getSectorPolygonForSectorIndex(index).map(i => [scaled(i.x, 'x'), scaled(i.y, 'z')]);

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

      const getSectorForPoint = (x, y) => polygons.find(sector => (
        sector.bounds[0][0] <= x && sector.bounds[1][0] >= x
        && sector.bounds[0][1] <= y && sector.bounds[1][1] >= y
        && pointIsInPolygon(x, y, sector.polygon)
      ));

      let startPosition;
      const sprites = things.map(({
        x, y, type, angle,
      }, index) => {
        const thingDefinition = thingLookup.find(i => i[0] === type);
        if (!thingDefinition) return undefined;
        const [id, /* idHex */, /* version */, size, sprite, sequence] = thingDefinition;
        if (['none', 'none1', 'none4', 'none6'].indexOf(sprite) !== -1) return undefined;
        const sector = getSectorForPoint(scaled(x, 'x'), scaled(y, 'z'));
        if (type === 1) {
          startPosition = {
            x: scaled(x, 'x'),
            y: sector ? sector.floorHeight + 1.5 : 0,
            z: scaled(y, 'z'),
            angle: angle * (Math.PI / 180),
          };
          return undefined;
        }
        if (!sector) {
          console.log(`No sector found for thing ${JSON.stringify(things[index])}`);
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

      const html = await renderFile(
        `${DIRECTORIES.template}/index.ejs`,
        {
          name,
          planes,
          polygons,
          sprites,
          startPosition,
          imageSizes,
          skyNumber,
          SIZE_FACTOR: 0.0625,
        },
        {},
      );

      await writeFile(`${DIRECTORIES.public}/${name}.html`, html);
    });
  } catch (error) {
    console.error(error);
    process.exit();
  }
};

main();
