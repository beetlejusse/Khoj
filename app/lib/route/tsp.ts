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

// Simpler TSP solver that works with coordinate arrays
export function solveTSP(coordinates: { lat: number; lng: number }[]): number[] {
  if (coordinates.length <= 1) return [0];
  if (coordinates.length === 2) return [0, 1];
  
  // For small sets (< 10), use nearest neighbor heuristic
  if (coordinates.length < 10) {
    return nearestNeighborTSP(coordinates);
  }
  
  // For larger sets, use a simple greedy approach
  return nearestNeighborTSP(coordinates);
}

function nearestNeighborTSP(coordinates: { lat: number; lng: number }[]): number[] {
  const n = coordinates.length;
  const visited = new Array(n).fill(false);
  const route: number[] = [];
  
  // Start from first point
  let current = 0;
  visited[current] = true;
  route.push(current);
  
  // Find nearest unvisited neighbor
  for (let i = 1; i < n; i++) {
    let nearest = -1;
    let minDist = Infinity;
    
    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const dist = calculateDistance(
          coordinates[current].lat,
          coordinates[current].lng,
          coordinates[j].lat,
          coordinates[j].lng
        );
        
        if (dist < minDist) {
          minDist = dist;
          nearest = j;
        }
      }
    }
    
    if (nearest !== -1) {
      visited[nearest] = true;
      route.push(nearest);
      current = nearest;
    }
  }
  
  return route;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
