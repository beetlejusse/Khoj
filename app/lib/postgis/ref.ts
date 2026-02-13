import { db } from "@/app/db/db";
import { places } from "@/app/db/schema";
import { sql } from "drizzle-orm";

export async function getDistanceBetweenPlaces(
  placeId1: string,
  placeId2: string
): Promise<number | null> {
  try {
    const result = await db.execute(sql`
      SELECT ST_Distance(
        (SELECT location FROM places WHERE place_id = ${placeId1}),
        (SELECT location FROM places WHERE place_id = ${placeId2}),
        true
      ) as distance
    `);

    return result.rows[0]?.distance as number || null;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return null;
  }
}

/**
 * Find places within a radius of a given location
 * @param lat Latitude
 * @param lng Longitude
 * @param radiusMeters Radius in meters
 * @returns Array of place IDs within radius
 */
export async function findPlacesWithinRadius(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT place_id
      FROM places
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    `);

    return result.rows.map((row: any) => row.place_id);
  } catch (error) {
    console.error('Error finding places within radius:', error);
    return [];
  }
}

/**
 * Calculate the geographic center (centroid) of multiple places
 * @param placeIds Array of place IDs
 * @returns {lat, lng} of center point
 */
export async function calculateCenterOfPlaces(
  placeIds: string[]
): Promise<{ lat: number; lng: number } | null> {
  try {
    const result = await db.execute(sql`
      SELECT 
        ST_Y(ST_Centroid(ST_Collect(location))) as lat,
        ST_X(ST_Centroid(ST_Collect(location))) as lng
      FROM places
      WHERE place_id = ANY(${placeIds})
    `);

    const row = result.rows[0] as any;
    if (!row?.lat || !row?.lng) return null;

    return {
      lat: row.lat,
      lng: row.lng
    };
  } catch (error) {
    console.error('Error calculating center:', error);
    return null;
  }
}

/**
 * Calculate maximum distance between any two places in a set
 * @param placeIds Array of place IDs
 * @returns Maximum distance in meters
 */
export async function getMaxDistanceInSet(
  placeIds: string[]
): Promise<number | null> {
  try {
    const result = await db.execute(sql`
      SELECT MAX(
        ST_Distance(p1.location, p2.location, true)
      ) as max_distance
      FROM places p1
      CROSS JOIN places p2
      WHERE p1.place_id = ANY(${placeIds})
        AND p2.place_id = ANY(${placeIds})
        AND p1.place_id < p2.place_id
    `);

    return result.rows[0]?.max_distance as number || null;
  } catch (error) {
    console.error('Error calculating max distance:', error);
    return null;
  }
}
n               