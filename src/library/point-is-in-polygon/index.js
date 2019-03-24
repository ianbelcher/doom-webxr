module.exports = (x, y, polygon) => {
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