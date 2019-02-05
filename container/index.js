const { readFile: readFileCb, writeFile: writeFileCb } = require('fs');
const { promisify } = require('util');
const { readWad, createObjectModel } = require('@nrkn/wad');

const readFile = promisify(readFileCb);
const writeFile = promisify(writeFileCb);

const main = async () => {
  try {
    const wad = readWad(await readFile('doom.wad'));
    const doomObjectModel = createObjectModel(wad);
    const { levels, /* textures, patches etc */ } = doomObjectModel;
    const { vertexes, linedefs, sidedefs, sectors }  = levels.find(level => level.name === 'E1M1');
    
    const verticesRanges = vertexes.reduce(
      (c, v) => ({
        xMin: Math.min(c.xMin, v.x),
        yMin: Math.min(c.yMin, v.y),
        xMax: Math.max(c.xMax, v.x),
        yMax: Math.max(c.yMax, v.y),
      }),
      { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity },
      )
      const centerOfMass = {
        x: (verticesRanges.xMax + verticesRanges.xMin) / 2,
        y: 0,
        z: (verticesRanges.yMax + verticesRanges.yMin) / 2,
        none: 0,
      };

    const scale = 0.0325; // The factor we use to size the map coordinates etc.
    const scaled = (number, dimension = 'none') => (scale * (number - centerOfMass[dimension])) ;

    const isSky = (sector) => 
      ['F_SKY1', 'SKY1', 'SKY2', 'SKY3', 'SKY4' ].indexOf(sector.ceiling) !== -1;

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

    const planes = linedefs.reduce((planes, lineDef) => {
      // Need width, height, x, y, z and rotation for each plane
      const { leftSidedef: leftSideDefIndex, rightSidedef: rightSideDefIndex, startVertex, endVertex } = lineDef;
      const startPoint = vertexes[startVertex];
      const endPoint = vertexes[endVertex];
      const leftSideDef = leftSideDefIndex ? sidedefs[leftSideDefIndex] : false;
      const rightSideDef = rightSideDefIndex ? sidedefs[rightSideDefIndex] : false;
      const leftSideSector = leftSideDef ? sectors[leftSideDef.sector] : false;
      const rightSideSector = rightSideDef ? sectors[rightSideDef.sector] : false;
      const rise = endPoint.y - startPoint.y; // y movement
      const run = endPoint.x - startPoint.x; // x movement
      const rightSideRotation = Math.atan2(rise, run); // https://math.stackexchange.com/a/2587852
      const leftSideRotation = (rightSideRotation + 180) % 360; // The inverse angle of the rightSideRotation
      const plane = {
        width: scaled(Math.sqrt(Math.pow(rise, 2) + Math.pow(run, 2))), // Distance / pythagoras
        x: scaled((startPoint.x + endPoint.x) / 2, 'x'), // Middle
        z: scaled((startPoint.y + endPoint.y) / 2, 'z'), // Middle
      }

      if (leftSideDef && leftSideDef.middle !== '-') {
        planes.push({
          ...plane,
          y: scaled((leftSideSector.ceilingHeight + leftSideSector.floorHeight) / 2, 'y'),
          height: scaled(leftSideSector.ceilingHeight - leftSideSector.floorHeight, 'y'),
          rotation: leftSideRotation,
          src: leftSideDef.middle,
        });
      }
      if (leftSideDef && leftSideDef.upper !== '-' && (rightSideSector ? !isSky(rightSideSector) : true)) {
        planes.push({
          ...plane,
          y: scaled((leftSideSector.ceilingHeight + rightSideSector.ceilingHeight) / 2, 'y'),
          height: scaled(leftSideSector.ceilingHeight - rightSideSector.ceilingHeight, 'y'),
          rotation: leftSideRotation,
          src: leftSideDef.upper,
        });
      }
      if (leftSideDef && leftSideDef.lower !== '-' && (rightSideSector ? !isSky(rightSideSector) : true)) {
        planes.push({
          ...plane,
          y: scaled((rightSideSector.floorHeight + leftSideSector.floorHeight) / 2, 'y'),
          height: scaled(rightSideSector.floorHeight - leftSideSector.floorHeight, 'y'),
          rotation: leftSideRotation,
          src: leftSideDef.lower,
        });
      }

      if (rightSideDef && rightSideDef.middle !== '-') {
        planes.push({
          ...plane,
          y: scaled((rightSideSector.ceilingHeight + rightSideSector.floorHeight) / 2, 'y'),
          height: scaled(rightSideSector.ceilingHeight - rightSideSector.floorHeight, 'y'),
          rotation: rightSideRotation,
          src: rightSideDef.middle,
        });
      }
      if (rightSideDef && rightSideDef.upper !== '-' && (leftSideSector ? !isSky(leftSideSector) : true)) {
        planes.push({
          ...plane,
          y: scaled((rightSideSector.ceilingHeight + leftSideSector.ceilingHeight) / 2, 'y'),
          height: scaled(rightSideSector.ceilingHeight - leftSideSector.ceilingHeight, 'y'),
          rotation: rightSideRotation,
          src: rightSideDef.upper,
        });
      }
      if (rightSideDef && rightSideDef.lower !== '-' && (leftSideSector ? !isSky(leftSideSector) : true)) {
        planes.push({
          ...plane,
          y: scaled((leftSideSector.floorHeight + rightSideSector.floorHeight) / 2, 'y'),
          height: scaled(leftSideSector.floorHeight - rightSideSector.floorHeight, 'y'),
          rotation: rightSideRotation,
          src: rightSideDef.lower,
        });
      }

      return planes;
    }, [])
    .filter(i => i.height > 0.0001);


    const getSectorPolygon = (sidedefs) => {
      // Make a copy of the sidedefs object for our own purposes
      const sides = [ ...sidedefs ];
      // Populate the start of the polygon and the next coordinate that we're looking for
      const polygon = [sides[0].start];
      let nextCoordinate = sides[0].end;
      sides.splice(0, 1);
      while (sides.length) {
        // Iterate through the sides and connect them all up together.
        polygon.push(nextCoordinate);
        const nextSidedefStart = sides.find(sd => sd.start.x === nextCoordinate.x && sd.start.y === nextCoordinate.y);
        const nextSidedefEnd = sides.find(sd => sd.end.x === nextCoordinate.x && sd.end.y === nextCoordinate.y);
        if (nextSidedefStart) {
          // There is a side that starts with the ending coordinate of the last side we observed. Use it as the next one.
          sides.splice(sides.indexOf(nextSidedefStart), 1);
          nextCoordinate = nextSidedefStart.end;
        } else if (nextSidedefEnd) {
          // There is a side that ends with the ending coordinate of the last side we observed. Use it as the next one.
          sides.splice(sides.indexOf(nextSidedefEnd), 1);
          nextCoordinate = nextSidedefEnd.start;
        } else {
          break;
        }
      }
      return polygon;
    }

    const polygons = sectors.map((sector, index) => {
      const sectorSidedefs = sidedefs
        .map((sidedef, index) => ({ ...sidedef, index }))
        .filter(sidedef => sidedef.sector === index)
        .map(sidedef => {
          // Find the corresponding linedef for this sidedef and the sidedef from the other side if it exists.
          const linedef = linedefs.find(linedef => linedef.rightSidedef === sidedef.index || linedef.leftSidedef === sidedef.index)
          const otherSide = linedef.rightSidedef === sidedef.index ? linedef.leftSidedef : linedef.rightSidedef
          return {
            ...sidedef,
            start: vertexes[linedef.startVertex],
            end: vertexes[linedef.endVertex],
            otherSector: sidedefs[otherSide] ? sidedefs[otherSide].sector : undefined,
          }
        });

      return {
        ...sector,
        sectorId: index,
        isSky: isSky(sector),
        floorHeight: scaled(sector.floorHeight),
        ceilingHeight: scaled(sector.ceilingHeight),
        // sidedefs,
        polygon: getSectorPolygon(sectorSidedefs).map(i => [scaled(i.x, 'x'), scaled(i.y, 'z')]),
      }
    });

    await writeFile('/web/data.js', `const map = ${JSON.stringify({ planes, polygons })}`);

  } catch (error) {
    console.error(error);
    process.exit();
  }
}

main();
