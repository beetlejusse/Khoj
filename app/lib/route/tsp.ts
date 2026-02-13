// Simple TSP solver using brute force for small sets
export function optimizeRoute(placeIds: string[], distanceMatrix: Record<string, Record<string, number>>): string[] {
  if (placeIds.length <= 1) return placeIds;
  
  const permutations = generatePermutations(placeIds);
  let bestRoute = placeIds;
  let shortestDistance = Infinity;
  
  for (const perm of permutations) {
    let totalDistance = 0;
    for (let i = 0; i < perm.length - 1; i++) {
      totalDistance += distanceMatrix[perm[i]][perm[i + 1]];
    }
    
    if (totalDistance < shortestDistance) {
      shortestDistance = totalDistance;
      bestRoute = perm;
    }
  }
  
  return bestRoute;
}

function generatePermutations(arr: string[]): string[][] {
  if (arr.length <= 1) return [arr];
  
  const result: string[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = generatePermutations(rest);
    for (const perm of perms) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}
