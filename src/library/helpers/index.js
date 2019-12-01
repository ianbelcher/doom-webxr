const { SIZE_FACTOR } = require('../../configuration');

module.exports = (level) => {
  const { vertexes } = level;
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

  const pointIsInPolygon = (x, y, polygon) => {
    // Ray-trace along x axis. Find all points where:
    // 1) a polygon edge crossed over the x axis at a position xIntersect
    // 2) where the start vertex of the edge and the y vertex are equal we need to walk out
    //    and find the next vertex that is off that axis and ensure that one diverges above
    //    and the other below.
    // 3) Count the number of instance the above happens where the intersect has a value less
    //    than x. If we have an odd number of results, the point is inside the polygon.
    let intersectingEdges = 0;
    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
      const nextIndex = index => (index !== polygon.length - 1 ? index + 1 : 0);
      const previousIndex = index => (index ? index - 1 : polygon.length - 1);
      let edgeIndexNext = nextIndex(edgeIndex);
      let edgeIndexPrevious = previousIndex(edgeIndex);

      if (
        (polygon[edgeIndex][1] < y && polygon[edgeIndexNext][1] > y)
        || (polygon[edgeIndex][1] > y && polygon[edgeIndexNext][1] < y)
      ) {
        // We have an intersection of the x axis. Calculate the xIntersect.
        const totalRise = polygon[edgeIndexNext][1] - polygon[edgeIndex][1];
        const intersectRise = y - polygon[edgeIndex][1];
        const totalRun = polygon[edgeIndexNext][0] - polygon[edgeIndex][0];
        const xIntersect = ((intersectRise / totalRise) * totalRun) + polygon[edgeIndex][0];

        if (xIntersect < x) {
          intersectingEdges += 1;
        }
      }

      if (
        polygon[edgeIndex][0] < x
        && polygon[edgeIndex][1] === y
        && polygon[edgeIndexPrevious][1] !== y
      ) {
        while (polygon[edgeIndexNext][1] === y) {
          edgeIndexNext = nextIndex(edgeIndexNext);
        }
        while (polygon[edgeIndexPrevious][1] === y) {
          edgeIndexPrevious = previousIndex(edgeIndexPrevious);
        }
        if (
          (polygon[edgeIndexPrevious][1] < y && polygon[edgeIndexNext][1] > y)
          || (polygon[edgeIndexPrevious][1] > y && polygon[edgeIndexNext][1] < y)
        ) {
          // We have a shared point on the y axis. The xIntersect is simply
          // equal to the polygons x value which checked was < x above
          intersectingEdges += 1;
        }
      }
    }

    return intersectingEdges % 2 > 0;
  };

  // This gets pretty complicated. Sectors can fully enclose other sectors (think the pool
  // outside in E1M1). We need to carve out these sections in the outer sector polygon to
  // avoid having the floor or ceiling covering the inner sector. It also means that only
  // one sector can exist in any given spot which allows us to determine heights of things
  // and other assets in the map.
  // Algorithm we're using is:
  // - Take a vertex from each polygon and ray-trace it against the current. If that vertex
  //   point is _inside_ (not a shared vertex) then we assume it that the current polygon
  //   envelopes that polygon. (Doom can't have intersecting polygon edges).
  // - Find the two closest vertices from the outer and inner polygons.
  // - Added inner polygon points to the outer at that point of the array, returning to the
  //   original point.
  const carveOutOverlappingPolygons = (currentSector, index, allSectors) => {
    const { polygon: currentPolygon, bounds: currentBounds } = currentSector;
    let returnedPolygon = currentPolygon;

    allSectors.forEach(({ polygon: toCheckPolygon }) => {
      // We take a point from the toCheckPolygon which doesn't share a common vertex with
      // the returnedPolygon
      const result = toCheckPolygon.find(
        ([x, y]) => !returnedPolygon.find(vertex => vertex[0] === x && vertex[1] === y),
      );
      // If we don't have an exclusive points within returnedPolygon compared to toCheckPolygon
      // it means that the polygons are equal (all the same points) or that toCheckPolygon segments
      // returnedPolygon which can't happen in doom as sectors need to be contiguous (I believe!?).
      // Just return the current sector without any changes as there isn't anything we can do in
      // this case
      if (!result) return;
      const [x, y] = result;

      if (
        // Initially check bounds which is computationally much cheaper than raytracing
        currentBounds[0][0] <= x && currentBounds[1][0] >= x
        && currentBounds[0][1] <= y && currentBounds[1][1] >= y
        // Ok, if the bounds are a match actually raytrace the point against the polygon.
        && pointIsInPolygon(x, y, returnedPolygon)
      ) {
        let closestTwoVertices = {
          returnedPolygonBestVertex: null,
          toCheckPolygonBestVertex: null,
          distance: Infinity,
        };
        returnedPolygon.forEach((returnedPolygonVertex) => {
          toCheckPolygon.forEach((toCheckPolygonVertex) => {
            // No need to sqrt here... The result doesn't need to actual distance units.
            const distance = (
              ((toCheckPolygonVertex[0] - returnedPolygonVertex[0]) ** 2)
              + ((toCheckPolygonVertex[1] - returnedPolygonVertex[1]) ** 2)
            );
            if (distance < closestTwoVertices.distance) {
              closestTwoVertices = {
                returnedPolygonBestVertex: returnedPolygonVertex,
                toCheckPolygonBestVertex: toCheckPolygonVertex,
                distance,
              };
            }
          });
        });

        const { returnedPolygonBestVertex, toCheckPolygonBestVertex } = closestTwoVertices;

        // Add a carved out section to the returnedPolygon of the reversed toCheckPolygon.
        // This results in a non-intersecting concave polygon that does not include the
        // toCheckPolygon
        const toCheckReversed = toCheckPolygon.reverse();
        returnedPolygon = [
          ...returnedPolygon.slice(returnedPolygon.indexOf(returnedPolygonBestVertex)),
          ...returnedPolygon.slice(0, returnedPolygon.indexOf(returnedPolygonBestVertex)),
          returnedPolygonBestVertex,
          toCheckPolygonBestVertex,
          ...toCheckReversed.slice(toCheckReversed.indexOf(toCheckPolygonBestVertex)),
          ...toCheckReversed.slice(0, toCheckReversed.indexOf(toCheckPolygonBestVertex)),
          toCheckPolygonBestVertex,
          returnedPolygonBestVertex,
        ];
      }
    });

    return {
      ...currentSector,
      polygon: returnedPolygon,
    };
  };

  const getSectorForPointFactory = polygons => (x, y) => polygons.find(sector => (
    sector.bounds[0][0] <= x && sector.bounds[1][0] >= x
    && sector.bounds[0][1] <= y && sector.bounds[1][1] >= y
    && pointIsInPolygon(x, y, sector.polygon)
  ));

  const scaled = (number, dimension = 'none') => (SIZE_FACTOR * (number - centerOfMass[dimension]));

  const isSky = sector => ['F_SKY1', 'SKY1', 'SKY2', 'SKY3', 'SKY4'].indexOf(sector.ceiling) !== -1;

  return {
    scaled,
    isSky,
    pointIsInPolygon,
    getSectorForPointFactory,
    carveOutOverlappingPolygons,
  };
};
