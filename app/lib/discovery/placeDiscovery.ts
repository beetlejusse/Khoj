import client from '../googlePlaces/client';
import { db } from '@/app/db/db';
import { places, userPlaces } from '@/app/db/schema';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { PLACE_TYPE_PRIORITY } from '../placesTypes';

interface DiscoveryParams {
  region: string;
  interests: string[];
  userId?: string;
  limit?: number;
  excludePlaceIds?: string[];
}

interface DiscoveredPlace {
  placeId: string;
  placeName: string;
  placeType: string;
  rating: number;
  lat: number;
  lng: number;
  formattedAddress: string;
  source: 'google' | 'instagram' | 'combined';
  relevanceScore: number;
  photoReference?: string;
}

function getType(types?: string[] | null): string {
  if (!types) return 'other';
  for (const i of PLACE_TYPE_PRIORITY) {
    if (types.includes(i)) return i;
  }
  return 'other';
}

function calculateRelevanceScore(
  place: any,
  interests: string[],
  source: string,
  distanceFromTarget?: number
): number {
  let score = 0;

  // MASSIVE boost for user's saved places - they should ALWAYS appear first
  if (source === 'instagram') score += 100;
  
  // Proximity bonus (if near target location like Jama Masjid)
  if (distanceFromTarget !== undefined) {
    if (distanceFromTarget < 1) score += 40; // Within 1km
    else if (distanceFromTarget < 3) score += 30; // Within 3km
    else if (distanceFromTarget < 5) score += 20; // Within 5km
    else if (distanceFromTarget < 10) score += 10; // Within 10km
  }
  
  if (place.rating) {
    score += Math.min(place.rating * 5, 25); // Reduced rating impact
  }

  const placeType = place.placeType || place.type || '';
  const placeName = (place.placeName || place.displayName || '').toLowerCase();
  
  for (const interest of interests) {
    const interestLower = interest.toLowerCase();
    if (placeType.includes(interestLower) || placeName.includes(interestLower)) {
      score += 15;
    }
  }

  return score;
}

export async function discoverPlaces(params: DiscoveryParams): Promise<DiscoveredPlace[]> {
  const { region, interests, userId, limit = 30, excludePlaceIds = [] } = params;

  const allPlaces: DiscoveredPlace[] = [];

  console.log('=== DISCOVERY: Starting place discovery ===');
  console.log('Region:', region);
  console.log('Interests:', interests);
  console.log('UserId:', userId);
  console.log('Limit:', limit);
  console.log('Exclude IDs:', excludePlaceIds);

  // Step 1: Get target location coordinates (if region is a specific place like "Jama Masjid")
  let targetLat: number | undefined;
  let targetLng: number | undefined;
  
  console.log('\n=== DISCOVERY: Finding target location ===');
  try {
    const [locationResponse] = await client.searchText(
      {
        textQuery: region,
        languageCode: 'en',
        maxResultCount: 1
      },
      {
        otherArgs: {
          headers: {
            'X-Goog-FieldMask': 'places.location,places.displayName'
          }
        }
      }
    );
    
    if (locationResponse.places?.[0]?.location) {
      targetLat = locationResponse.places[0].location.latitude;
      targetLng = locationResponse.places[0].location.longitude;
      console.log(`Target location found: ${locationResponse.places[0].displayName?.text}`);
      console.log(`Coordinates: ${targetLat}, ${targetLng}`);
    }
  } catch (error) {
    console.log('Could not find specific target location, will use text matching');
  }

  // Step 2: Get ALL user saved places (no filtering yet)
  if (userId) {
    console.log('\n=== DISCOVERY: Querying ALL user saved places ===');
    
    const userPlacesData = await db
      .select({
        placeId: places.placeId,
        placeName: places.displayName,
        placeType: places.type,
        lat: places.lat,
        lng: places.lng,
        formattedAddress: places.formattedAddress
      })
      .from(userPlaces)
      .innerJoin(places, eq(userPlaces.placeId, places.placeId))
      .where(eq(userPlaces.userId, userId));

    console.log('Total user places found:', userPlacesData.length);
    console.log('User places:', userPlacesData.map(p => p.placeName).join(', '));

    // Step 3: Calculate distance and relevance for each user place
    console.log('\n=== DISCOVERY: Processing user places ===');
    
    for (const place of userPlacesData) {
      if (excludePlaceIds.includes(place.placeId)) {
        console.log(`Skipping ${place.placeName} - in exclude list`);
        continue;
      }

      let distance: number | undefined;
      if (targetLat && targetLng && place.lat && place.lng) {
        distance = calculateDistance(targetLat, targetLng, place.lat, place.lng);
        console.log(`${place.placeName}: ${distance.toFixed(2)}km from target`);
      }

      // Check if place matches region by text OR proximity
      const regionLower = region.toLowerCase();
      const addressLower = (place.formattedAddress || '').toLowerCase();
      const placeNameLower = (place.placeName || '').toLowerCase();
      
      // Split region into words for flexible matching (e.g., "jama masjid" matches "jama" or "masjid")
      const regionWords = regionLower.split(/\s+/).filter(w => w.length > 3);
      
      const textMatch = addressLower.includes(regionLower) || 
                       placeNameLower.includes(regionLower) ||
                       regionWords.some(word => addressLower.includes(word) || placeNameLower.includes(word));
      
      // STRICTER proximity match - only within 50km (not 10km like before)
      const proximityMatch = distance !== undefined && distance < 50;
      
      // IMPORTANT: For user places, require BOTH text match in address AND proximity
      // This prevents showing "City Palace Delhi" when searching for "City Palace Udaipur"
      const addressContainsRegion = addressLower.includes(regionLower) || 
                                    regionWords.some(word => addressLower.includes(word));
      
      if ((addressContainsRegion && proximityMatch) || (textMatch && distance !== undefined && distance < 10)) {
        const relevanceScore = calculateRelevanceScore(place, interests, 'instagram', distance);
        
        const matchReason = textMatch ? 'text match' : 'proximity match';
        console.log(`✅ Adding ${place.placeName} (score: ${relevanceScore}, distance: ${distance?.toFixed(2) || 'N/A'}km, reason: ${matchReason})`);
        
        allPlaces.push({
          placeId: place.placeId,
          placeName: place.placeName || '',
          placeType: place.placeType || 'other',
          rating: 0,
          lat: place.lat || 0,
          lng: place.lng || 0,
          formattedAddress: place.formattedAddress || '',
          source: 'instagram',
          relevanceScore
        });
      } else {
        console.log(`❌ Skipping ${place.placeName} - no match (distance: ${distance?.toFixed(2) || 'N/A'}km, address: ${addressLower.substring(0, 50)}...)`);
      }
    }
    
    console.log(`User places added: ${allPlaces.filter(p => p.source === 'instagram').length}`);
  }

  console.log('\n=== DISCOVERY: Querying Google Places API ===');
  
  // Make queries very specific to the target location
  const interestQueries = interests.length > 0 
    ? interests.map(interest => `${interest} near ${region}`)
    : [`popular places near ${region}`, `things to do near ${region}`];
  
  // Add specific local specialties if it's a food query
  if (interests.includes('food') || interests.includes('restaurant')) {
    interestQueries.push(`famous food ${region}`);
    interestQueries.push(`street food ${region}`);
  }

  console.log('Google queries to execute:', interestQueries.slice(0, 4));

  for (const query of interestQueries.slice(0, 4)) {
    try {
      console.log(`\nExecuting Google query: "${query}"`);
      
      // Build search request with location bias if we have target coordinates
      const searchRequest: any = {
        textQuery: query,
        languageCode: 'en',
        maxResultCount: 10
      };
      
      // Add location bias to prioritize results near target location
      if (targetLat && targetLng) {
        searchRequest.locationBias = {
          circle: {
            center: {
              latitude: targetLat,
              longitude: targetLng
            },
            radius: 10000 // 10km radius
          }
        };
        console.log(`Using location bias: ${targetLat}, ${targetLng} (10km radius)`);
      }
      
      const [response] = await client.searchText(
        searchRequest,
        {
          otherArgs: {
            headers: {
              'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.photos'
            }
          }
        }
      );

      console.log('Google API response received');
      console.log('Places found:', response.places?.length || 0);

      if (response.places) {
        for (const place of response.places) {
          if (!place.id || excludePlaceIds.includes(place.id)) continue;

          const existingIndex = allPlaces.findIndex(p => p.placeId === place.id);
          if (existingIndex >= 0) {
            // IMPORTANT: Keep source as 'instagram' if it was user's saved place
            if (allPlaces[existingIndex].source === 'instagram') {
              console.log(`Place "${place.displayName?.text}" is user's saved place, keeping as instagram`);
              allPlaces[existingIndex].relevanceScore += 20; // Boost for being in both
            } else {
              console.log(`Place "${place.displayName?.text}" already exists, marking as combined`);
              allPlaces[existingIndex].source = 'combined';
              allPlaces[existingIndex].relevanceScore += 10;
            }
            continue;
          }

          // Calculate distance from target for proximity filtering
          let distanceFromTarget: number | undefined;
          if (targetLat && targetLng && place.location) {
            distanceFromTarget = calculateDistance(
              targetLat, targetLng,
              place.location.latitude || 0,
              place.location.longitude || 0
            );
          }

          // Only include Google places that are NEAR the target location (within 3km)
          if (distanceFromTarget !== undefined && distanceFromTarget > 3) {
            console.log(`Skipping "${place.displayName?.text}" - too far (${distanceFromTarget.toFixed(2)}km)`);
            continue;
          }

          const placeData = {
            placeId: place.id,
            placeName: place.displayName?.text || '',
            placeType: getType(place.types),
            rating: place.rating || 0,
            lat: place.location?.latitude || 0,
            lng: place.location?.longitude || 0,
            formattedAddress: place.formattedAddress || '',
            source: 'google' as const,
            relevanceScore: calculateRelevanceScore({
              ...place,
              displayName: place.displayName?.text,
              type: getType(place.types)
            }, interests, 'google', distanceFromTarget),
            photoReference: place.photos?.[0]?.name
          };

          console.log(`Adding Google place: "${placeData.placeName}" (score: ${placeData.relevanceScore}, distance: ${distanceFromTarget?.toFixed(2) || 'N/A'}km)`);
          allPlaces.push(placeData);
        }
      }
    } catch (error) {
      console.error(`Error searching for "${query}":`, error);
    }
  }

  // Step 4: Web search for local recommendations from blogs/articles
  console.log('\n=== DISCOVERY: Web search for local recommendations ===');
  try {
    const webSearchQuery = `best places to eat at ${region} hidden gems local favorites`;
    console.log('Web search query:', webSearchQuery);
    
    // Note: Web search would be implemented here using a search API
    // For now, we'll use the LLM's knowledge + Google Places as primary sources
    // Future enhancement: Integrate with web search API to find blog recommendations
    
  } catch (error) {
    console.error('Web search error:', error);
  }

  console.log('\n=== DISCOVERY: Deduplicating and sorting ===');
  console.log('Total places before deduplication:', allPlaces.length);
  console.log('Instagram places:', allPlaces.filter(p => p.source === 'instagram').length);
  console.log('Google places:', allPlaces.filter(p => p.source === 'google').length);
  console.log('Combined places:', allPlaces.filter(p => p.source === 'combined').length);

  const deduplicatedPlaces = deduplicatePlaces(allPlaces);
  console.log('Places after deduplication:', deduplicatedPlaces.length);
  
  deduplicatedPlaces.sort((a, b) => b.relevanceScore - a.relevanceScore);
  console.log('Places sorted by relevance');

  const finalPlaces = deduplicatedPlaces.slice(0, limit);
  console.log('\n=== DISCOVERY: Final results ===');
  console.log('Returning', finalPlaces.length, 'places');
  console.log('Top 5 places:');
  finalPlaces.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.placeName} (${p.source}, score: ${p.relevanceScore})`);
  });

  return finalPlaces;
}

function deduplicatePlaces(places: DiscoveredPlace[]): DiscoveredPlace[] {
  const uniquePlaces = new Map<string, DiscoveredPlace>();

  for (const place of places) {
    const existing = uniquePlaces.get(place.placeId);
    if (!existing || place.relevanceScore > existing.relevanceScore) {
      uniquePlaces.set(place.placeId, place);
    }
  }

  const placesList = Array.from(uniquePlaces.values());

  const filtered: DiscoveredPlace[] = [];
  for (const place of placesList) {
    const isDuplicate = filtered.some(existing => {
      const distance = calculateDistance(
        place.lat, place.lng,
        existing.lat, existing.lng
      );
      return distance < 0.05 && place.placeName.toLowerCase() === existing.placeName.toLowerCase();
    });

    if (!isDuplicate) {
      filtered.push(place);
    }
  }

  return filtered;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function refineSearch(params: DiscoveryParams & { subRegion?: string }): Promise<DiscoveredPlace[]> {
  const refinedRegion = params.subRegion 
    ? `${params.subRegion}, ${params.region}`
    : params.region;

  return discoverPlaces({
    ...params,
    region: refinedRegion
  });
}

export async function findSimilarPlaces(
  placeId: string,
  region: string,
  limit: number = 5
): Promise<DiscoveredPlace[]> {
  try {
    const [placeDetails] = await db
      .select()
      .from(places)
      .where(eq(places.placeId, placeId))
      .limit(1);

    if (!placeDetails) {
      return [];
    }

    const query = `${placeDetails.type} similar to ${placeDetails.displayName} in ${region}`;

    const [response] = await client.searchText(
      {
        textQuery: query,
        languageCode: 'en',
        maxResultCount: limit + 1
      },
      {
        otherArgs: {
          headers: {
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating'
          }
        }
      }
    );

    if (!response.places) {
      return [];
    }

    const similarPlaces: DiscoveredPlace[] = [];
    for (const place of response.places) {
      if (place.id === placeId) continue;

      similarPlaces.push({
        placeId: place.id || '',
        placeName: place.displayName?.text || '',
        placeType: getType(place.types),
        rating: place.rating || 0,
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        formattedAddress: place.formattedAddress || '',
        source: 'google',
        relevanceScore: place.rating ? place.rating * 10 : 50
      });
    }

    return similarPlaces.slice(0, limit);
  } catch (error) {
    console.error('Error finding similar places:', error);
    return [];
  }
}
