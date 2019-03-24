const pointIsInPolygon = require('../point-is-in-polygon');

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
module.exports = (currentSector, index, allSectors) => {
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
    // Just return the current sector without any changes as there isn't anything we can do in this
    // case
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
      // This results in a non-intersecting concave polygon that does not include the toCheckPolygon
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
