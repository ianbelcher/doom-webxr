const { readFile: readFileCb, writeFile: writeFileCb, readdir: readdirCb } = require('fs');
const { promisify } = require('util');
const { readWad, createObjectModel } = require('@nrkn/wad');

const readFile = promisify(readFileCb);
const writeFile = promisify(writeFileCb);
const readdir = promisify(readdirCb);

const main = async () => {
  try {
    const assetsAvailable = await readdir('/web/assets');
    const assetSizes = require('/container/sizes.json');

    const wad = readWad(await readFile('doom.wad'));
    const doomObjectModel = createObjectModel(wad);
    const { levels, /* textures, patches etc */ } = doomObjectModel;
    const { vertexes, linedefs, sidedefs, sectors, things } = levels.find(level => level.name === 'E1M1');

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
    const scaled = (number, dimension = 'none') => (scale * (number - centerOfMass[dimension]));

    const isSky = (sector) =>
      ['F_SKY1', 'SKY1', 'SKY2', 'SKY3', 'SKY4'].indexOf(sector.ceiling) !== -1;

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
      const leftSideRotation = Math.atan2(-1 * rise, -1 * run);; // The inverse angle of the rightSideRotation
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
      const sides = [...sidedefs];
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

    let startPosition;
    const sprites = things.map(({ x, y: z, type, angle }) => {
      const thingDefinition = thingLookup.find(i => i[0] === type);
      if (!thingDefinition) return undefined;
      const [ id, /* idHex */, /* version */, size, sprite, sequence ] = thingDefinition;
      if (['none', 'none1', 'none4', 'none6'].indexOf(sprite) !== -1) return undefined;
      if (type === 1) {
        startPosition = {
          x: scaled(x, 'x'),
          y: 0,
          z: scaled(z, 'z'),
          angle: angle * (Math.PI / 180),
        };
        return undefined;
      }
      let src;
      if (sequence === '+') {
        const regex = new RegExp(`^${sprite}.+1`);
        src = assetsAvailable.filter(asset => regex.exec(asset));
      } else {
        const regex = new RegExp(`^${sprite}[${sequence}]+0`);
        src = assetsAvailable.filter(asset => regex.exec(asset));
      }
      
      return {
        id,
        size,
        src: src.map(i => i.replace('.png', '')),
        x: scaled(x, 'x'),
        z: scaled(z, 'z'),
      }
    })
    .filter( i => i);

    await writeFile('/web/data.js', `const map = ${JSON.stringify({ planes, polygons, sprites, startPosition, assetSizes })}`);

  } catch (error) {
    console.error(error);
    process.exit();
  }
}

const thingLookup = [
  [1, '1', 'S', 16, 'PLAY', '+', '', 'Player 1 start'],
  [2, '2', 'S', 16, 'PLAY', '+', '', 'Player 2 start'],
  [3, '3', 'S', 16, 'PLAY', '+', '', 'Player 3 start'],
  [4, '4', 'S', 16, 'PLAY', '+', '', 'Player 4 start'],
  [5, '5', 'S', 20, 'BKEY', 'AB', 'P', 'Blue keycard'],
  [6, '6', 'S', 20, 'YKEY', 'AB', 'P', 'Yellow keycard'],
  [7, '7', 'R', 128, 'SPID', '+', 'MO', 'Spider Mastermind'],
  [8, '8', 'S', 20, 'BPAK', 'A', 'P', 'Backpack'],
  [9, '9', 'S', 20, 'SPOS', '+', 'MO', 'Former Human Sergeant'],
  [10, 'A', 'S', 16, 'PLAY', 'W', '', 'Bloody mess'],
  [11, 'B', 'S', 20, 'none', '-', '', 'Deathmatch start'],
  [12, 'C', 'S', 16, 'PLAY', 'W', '', 'Bloody mess'],
  [13, 'D', 'S', 20, 'RKEY', 'AB', 'P', 'Red keycard'],
  [14, 'E', 'S', 20, 'none1', '-', '', 'Teleport landing'],
  [15, 'F', 'S', 16, 'PLAY', 'N', '', 'Dead player'],
  [16, '10', 'R', 40, 'CYBR', '+', 'MO', 'Cyberdemon'],
  [17, '11', 'R', 20, 'CELP', 'A', 'P2', 'Cell charge pack'],
  [18, '12', 'S', 20, 'POSS', 'L', '', 'Dead former human'],
  [19, '13', 'S', 20, 'SPOS', 'L', '', 'Dead former sergeant'],
  [20, '14', 'S', 20, 'TROO', 'M', '', 'Dead imp'],
  [21, '15', 'S', 30, 'SARG', 'N', '', 'Dead demon'],
  [22, '16', 'R', 31, 'HEAD', 'L', '', 'Dead cacodemon'],
  [23, '17', 'R', 16, 'SKUL', 'K', '', 'Dead lost soul (invisible)'],
  [24, '18', 'S', 16, 'POL5', 'A', '', 'Pool of blood and flesh'],
  [25, '19', 'R', 16, 'POL1', 'A', 'O', 'Impaled human'],
  [26, '1A', 'R', 16, 'POL6', 'AB', 'O', 'Twitching impaled human'],
  [27, '1B', 'R', 16, 'POL4', 'A', 'O', 'Skull on a pole'],
  [28, '1C', 'R', 16, 'POL2', 'A', 'O', 'Five skulls "shish kebab"'],
  [29, '1D', 'R', 16, 'POL3', 'AB', 'O', 'Pile of skulls and candles'],
  [30, '1E', 'R', 16, 'COL1', 'A', 'O', 'Tall green pillar'],
  [31, '1F', 'R', 16, 'COL2', 'A', 'O', 'Short green pillar'],
  [32, '20', 'R', 16, 'COL3', 'A', 'O', 'Tall red pillar'],
  [33, '21', 'R', 16, 'COL4', 'A', 'O', 'Short red pillar'],
  [34, '22', 'S', 16, 'CAND', 'A', '', 'Candle'],
  [35, '23', 'S', 16, 'CBRA', 'A', 'O', 'Candelabra'],
  [36, '24', 'R', 16, 'COL5', 'AB', 'O', 'Short green pillar with beating heart'],
  [37, '25', 'R', 16, 'COL6', 'A', 'O', 'Short red pillar with skull'],
  [38, '26', 'R', 20, 'RSKU', 'AB', 'P', 'Red skull key'],
  [39, '27', 'R', 20, 'YSKU', 'AB', 'P', 'Yellow skull key'],
  [40, '28', 'R', 20, 'BSKU', 'AB', 'P', 'Blue skull key'],
  [41, '29', 'R', 16, 'CEYE', 'ABCB', 'O', 'Evil eye'],
  [42, '2A', 'R', 16, 'FSKU', 'ABC', 'O', 'Floating skull'],
  [43, '2B', 'R', 16, 'TRE1', 'A', 'O', 'Burnt tree'],
  [44, '2C', 'R', 16, 'TBLU', 'ABCD', 'O', 'Tall blue firestick'],
  [45, '2D', 'R', 16, 'TGRN', 'ABCD', 'O', 'Tall green firestick'],
  [46, '2E', 'S', 16, 'TRED', 'ABCD', 'O', 'Tall red firestick'],
  [47, '2F', 'R', 16, 'SMIT', 'A', 'O', 'Stalagmite'],
  [48, '30', 'S', 16, 'ELEC', 'A', 'O', 'Tall techno pillar'],
  [49, '31', 'R', 16, 'GOR1', 'ABCB', 'O^', 'Hanging victim, twitching'],
  [50, '32', 'R', 16, 'GOR2', 'A', 'O^', 'Hanging victim, arms out'],
  [51, '33', 'R', 16, 'GOR3', 'A', 'O^', 'Hanging victim, one-legged'],
  [52, '34', 'R', 16, 'GOR4', 'A', 'O^', 'Hanging pair of legs'],
  [53, '35', 'R', 16, 'GOR5', 'A', 'O^', 'Hanging leg'],
  [54, '36', 'R', 32, 'TRE2', 'A', 'O', 'Large brown tree'],
  [55, '37', 'R', 16, 'SMBT', 'ABCD', 'O', 'Short blue firestick'],
  [56, '38', 'R', 16, 'SMGT', 'ABCD', 'O', 'Short green firestick'],
  [57, '39', 'R', 16, 'SMRT', 'ABCD', 'O', 'Short red firestick'],
  [58, '3A', 'S', 30, 'SARG', '+', 'MO', 'Spectre'],
  [59, '3B', 'R', 16, 'GOR2', 'A', '^', 'Hanging victim, arms out'],
  [60, '3C', 'R', 16, 'GOR4', 'A', '^', 'Hanging pair of legs'],
  [61, '3D', 'R', 16, 'GOR3', 'A', '^', 'Hanging victim, one-legged'],
  [62, '3E', 'R', 16, 'GOR5', 'A', '^', 'Hanging leg'],
  [63, '3F', 'R', 16, 'GOR1', 'ABCB', '^', 'Hanging victim, twitching'],
  [64, '40', '2', 20, 'VILE', '+', 'MO', 'Arch-Vile'],
  [65, '41', '2', 20, 'CPOS', '+', 'MO', 'Chaingunner'],
  [66, '42', '2', 20, 'SKEL', '+', 'MO', 'Revenant'],
  [67, '43', '2', 48, 'FATT', '+', 'MO', 'Mancubus'],
  [68, '44', '2', 64, 'BSPI', '+', 'MO', 'Arachnotron'],
  [69, '45', '2', 24, 'BOS2', '+', 'MO', 'Hell Knight'],
  [70, '46', '2', 10, 'FCAN', 'ABC', 'O', 'Burning barrel'],
  [71, '47', '2', 31, 'PAIN', '+', 'MO^', 'Pain Elemental'],
  [72, '48', '2', 16, 'KEEN', 'A+', 'MO^', 'Commander Keen'],
  [73, '49', '2', 16, 'HDB1', 'A', 'O^', 'Hanging victim, guts removed'],
  [74, '4A', '2', 16, 'HDB2', 'A', 'O^', 'Hanging victim, guts and brain removed'],
  [75, '4B', '2', 16, 'HDB3', 'A', 'O^', 'Hanging torso, looking down'],
  [76, '4C', '2', 16, 'HDB4', 'A', 'O^', 'Hanging torso, open skull'],
  [77, '4D', '2', 16, 'HDB5', 'A', 'O^', 'Hanging torso, looking up'],
  [78, '4E', '2', 16, 'HDB6', 'A', 'O^', 'Hanging torso, brain removed'],
  [79, '4F', '2', 16, 'POB1', 'A', '', 'Pool of blood'],
  [80, '50', '2', 16, 'POB2', 'A', '', 'Pool of blood'],
  [81, '51', '2', 16, 'BRS1', 'A', '', 'Pool of brains'],
  [82, '52', '2', 20, 'SGN2', 'A', 'WP3', 'Super shotgun'],
  [83, '53', '2', 20, 'MEGA', 'ABCD', 'AP', 'Megasphere'],
  [84, '54', '2', 20, 'SSWV', '+', 'MO', 'Wolfenstein SS'],
  [85, '55', '2', 16, 'TLMP', 'ABCD', 'O', 'Tall techno floor lamp'],
  [86, '56', '2', 16, 'TLP2', 'ABCD', 'O', 'Short techno floor lamp'],
  [87, '57', '2', 0, 'none4', '-', '', 'Spawn spot'],
  [88, '58', '2', 16, 'BBRN', '+', 'O5', 'Boss Brain'],
  [89, '59', '2', 20, 'none6', '-', '', 'Spawn shooter'],
  [2001, '7D1', 'S', 20, 'SHOT', 'A', 'WP3', 'Shotgun'],
  [2002, '7D2', 'S', 20, 'MGUN', 'A', 'WP3', 'Chaingun'],
  [2003, '7D3', 'S', 20, 'LAUN', 'A', 'WP3', 'Rocket launcher'],
  [2004, '7D4', 'R', 20, 'PLAS', 'A', 'WP3', 'Plasma rifle'],
  [2005, '7D5', 'S', 20, 'CSAW', 'A', 'WP7', 'Chainsaw'],
  [2006, '7D6', 'R', 20, 'BFUG', 'A', 'WP3', 'BFG 9000'],
  [2007, '7D7', 'S', 20, 'CLIP', 'A', 'P2', 'Ammo clip'],
  [2008, '7D8', 'S', 20, 'SHEL', 'A', 'P2', 'Shotgun shells'],
  [2010, '7DA', 'S', 20, 'ROCK', 'A', 'P2', 'Rocket'],
  [2011, '7DB', 'S', 20, 'STIM', 'A', 'P8', 'Stimpack'],
  [2012, '7DC', 'S', 20, 'MEDI', 'A', 'P8', 'Medikit'],
  [2013, '7DD', 'S', 20, 'SOUL', 'ABCDCB', 'AP', 'Soul sphere'],
  [2014, '7DE', 'S', 20, 'BON1', 'ABCDCB', 'AP', 'Health potion'],
  [2015, '7DF', 'S', 20, 'BON2', 'ABCDCB', 'AP', 'Spiritual armor'],
  [2018, '7E2', 'S', 20, 'ARM1', 'AB', 'P9', 'Green armor'],
  [2019, '7E3', 'S', 20, 'ARM2', 'AB', 'P10', 'Blue armor'],
  [2022, '7E6', 'R', 20, 'PINV', 'ABCD', 'AP', 'Invulnerability'],
  [2023, '7E7', 'R', 20, 'PSTR', 'A', 'AP', 'Berserk'],
  [2024, '7E8', 'S', 20, 'PINS', 'ABCD', 'AP', 'Invisibility'],
  [2025, '7E9', 'S', 20, 'SUIT', 'A', 'P', 'Radiation suit'],
  [2026, '7EA', 'S', 20, 'PMAP', 'ABCDCB', 'AP11', 'Computer map'],
  [2028, '7EC', 'S', 16, 'COLU', 'A', 'O', 'Floor lamp'],
  [2035, '7F3', 'S', 10, 'BAR1', 'AB+', 'O', 'Barrel'],
  [2045, '7FD', 'S', 20, 'PVIS', 'AB', 'AP', 'Light amplification visor'],
  [2046, '7FE', 'S', 20, 'BROK', 'A', 'P2', 'Box of rockets'],
  [2047, '7FF', 'R', 20, 'CELL', 'A', 'P2', 'Cell charge'],
  [2048, '800', 'S', 20, 'AMMO', 'A', 'P2', 'Box of ammo'],
  [2049, '801', 'S', 20, 'SBOX', 'A', 'P2', 'Box of shells'],
  [3001, 'BB9', 'S', 20, 'TROO', '+', 'MO', 'Imp'],
  [3002, 'BBA', 'S', 30, 'SARG', '+', 'MO', 'Demon'],
  [3003, 'BBB', 'S', 24, 'BOSS', '+', 'MO', 'Baron of Hell'],
  [3004, 'BBC', 'S', 20, 'POSS', '+', 'MO', 'Former Human Trooper'],
  [3005, 'BBD', 'R', 31, 'HEAD', '+', 'MO^', 'Cacodemon'],
  [3006, 'BBE', 'R', 16, 'SKUL', '+', 'M12O^', 'Lost Soul'],
];

main();