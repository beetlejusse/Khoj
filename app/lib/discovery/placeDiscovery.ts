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
  priorityPlaceTypes?: string[];
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
  distanceFromTarget?: number,
  priorityPlaceTypes?: string[]
): number {
  let score = 0;
  const debugInfo: string[] = [];

  // MASSIVE boost for user's saved places - they should ALWAYS appear first
  if (source === 'instagram') {
    score += 100;
    debugInfo.push('Instagram save: +100');
  }
  
  // Proximity bonus (if near target location)
  if (distanceFromTarget !== undefined) {
    if (distanceFromTarget < 1) {
      score += 40;
      debugInfo.push('Within 1km: +40');
    } else if (distanceFromTarget < 3) {
      score += 30;
      debugInfo.push('Within 3km: +30');
    } else if (distanceFromTarget < 5) {
      score += 20;
      debugInfo.push('Within 5km: +20');
    } else if (distanceFromTarget < 10) {
      score += 10;
      debugInfo.push('Within 10km: +10');
    }
  }
  
  // Rating bonus (capped to prevent over-weighting)
  if (place.rating) {
    const ratingBonus = Math.min(place.rating * 5, 25);
    score += ratingBonus;
    debugInfo.push(`Rating ${place.rating}: +${ratingBonus}`);
  }

  const placeType = (place.placeType || place.type || '').toLowerCase();
  const placeName = (place.placeName || place.displayName || '').toLowerCase();
  
  // DYNAMIC PRIORITY BOOST: Heavily weight what user asked for in latest message
  // This is the key to making the system context-aware
  if (priorityPlaceTypes && priorityPlaceTypes.length > 0) {
    let priorityMatched = false;
    
    for (const priorityType of priorityPlaceTypes) {
      const priorityLower = priorityType.toLowerCase();
      
      // Check if place matches the priority type
      if (placeType.includes(priorityLower) || placeName.includes(priorityLower)) {
        // HUGE boost - this is what user explicitly wants RIGHT NOW
        score += 60;
        priorityMatched = true;
        debugInfo.push(`🎯 PRIORITY MATCH "${priorityType}": +60`);
        break; // Only apply once per place
      }
    }
    
    // If place doesn't match priority, apply penalty to push it down
    // This ensures priority places dominate the results
    if (!priorityMatched && priorityPlaceTypes.length > 0) {
      score -= 20;
      debugInfo.push(`Not priority type: -20`);
    }
  }
  
  // General interest matching (smaller boost than priority)
  for (const interest of interests) {
    const interestLower = interest.toLowerCase();
    if (placeType.includes(interestLower) || placeName.includes(interestLower)) {
      score += 10;
      debugInfo.push(`Interest match "${interest}": +10`);
    }
  }

  // Log scoring breakdown for debugging
  if (debugInfo.length > 0) {
    console.log(`  Score breakdown for "${place.placeName || place.displayName}": ${debugInfo.join(', ')} = ${score}`);
  }

  return score;
}

export async function discoverPlaces(params: DiscoveryParams): Promise<DiscoveredPlace[]> {
  const { region, interests, userId, limit = 30, excludePlaceIds = [], priorityPlaceTypes = [] } = params;

  const allPlaces: DiscoveredPlace[] = [];

  console.log('=== DISCOVERY: Starting place discovery ===');
  console.log('Region:', region);
  console.log('Interests:', interests);
  console.log('Priority place types (from latest message):', priorityPlaceTypes);
  console.log('UserId:', userId);
  console.log('Limit:', limit);
  console.log('Exclude IDs:', excludePlaceIds);
  
  if (priorityPlaceTypes.length > 0) {
    console.log('⚡ PRIORITY MODE: Results will be heavily weighted toward:', priorityPlaceTypes.join(', '));
  }

  // Step 1: Get target location coordinates and determine search radius
  let targetLat: number | undefined;
  let targetLng: number | undefined;
  let searchRadius = 5000; // Default 5km for specific places
  let isCity = false;
  
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
            'X-Goog-FieldMask': 'places.location,places.displayName,places.types'
          }
        }
      }
    );
    
    if (locationResponse.places?.[0]?.location) {
      targetLat = locationResponse.places[0].location.latitude;
      targetLng = locationResponse.places[0].location.longitude;
      
      // Check if it's a city/locality (broader search) or specific place (narrow search)
      const types = locationResponse.places[0].types || [];
      isCity = types.some(t => ['locality', 'administrative_area_level_2', 'administrative_area_level_1'].includes(t));
      
      if (isCity) {
        searchRadius = 20000; // 20km for cities
        console.log(`Target is a city: ${locationResponse.places[0].displayName?.text}, using ${searchRadius/1000}km radius`);
      } else {
        searchRadius = 5000; // 5km for specific places
        console.log(`Target is a specific place: ${locationResponse.places[0].displayName?.text}, using ${searchRadius/1000}km radius`);
      }
      
      console.log(`Coordinates: ${targetLat}, ${targetLng}`);
    }
  } catch (error) {
    console.log('Could not find specific target location, will use text matching');
  }

  // Step 2: Get user saved places that match the destination
  if (userId) {
    console.log('\n=== DISCOVERY: Querying user saved places ===');
    
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

    for (const place of userPlacesData) {
      if (excludePlaceIds.includes(place.placeId)) {
        console.log(`Skipping ${place.placeName} - in exclude list`);
        continue;
      }

      let distance: number | undefined;
      if (targetLat && targetLng && place.lat && place.lng) {
        distance = calculateDistance(targetLat, targetLng, place.lat, place.lng);
      }

      // STRICT matching: Address must contain the region name
      const regionLower = region.toLowerCase();
      const addressLower = (place.formattedAddress || '').toLowerCase();
      
      // Extract city name from region (e.g., "Varanasi" from "Jama Masjid, Varanasi")
      const regionParts = regionLower.split(',').map(p => p.trim());
      const cityName = regionParts[regionParts.length - 1] || regionLower;
      
      const addressContainsCity = addressLower.includes(cityName);
      const withinRadius = distance !== undefined && distance < (searchRadius / 1000);
      
      if (addressContainsCity && withinRadius) {
        const relevanceScore = calculateRelevanceScore(place, interests, 'instagram', distance, priorityPlaceTypes);
        
        console.log(`✅ Adding ${place.placeName} (score: ${relevanceScore}, distance: ${distance?.toFixed(2)}km)`);
        
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
        console.log(`❌ Skipping ${place.placeName} - not in ${cityName} (distance: ${distance?.toFixed(2)}km, address: ${addressLower})`);
      }
    }
    
    console.log(`User places added: ${allPlaces.filter(p => p.source === 'instagram').length}`);
  }

  console.log('\n=== DISCOVERY: Querying Google Places API ===');
  
  // Make queries very specific to the target location
  const interestQueries = interests.length > 0 
    ? interests.map(interest => `${interest} in ${region}`)
    : [`popular places in ${region}`, `things to do in ${region}`];
  
  // Add specific queries for priority place types
  if (priorityPlaceTypes.length > 0) {
    for (const priorityType of priorityPlaceTypes) {
      // Add specific query for this priority type
      interestQueries.unshift(`${priorityType} in ${region}`);
      interestQueries.unshift(`famous ${priorityType} ${region}`);
      interestQueries.unshift(`best ${priorityType} ${region}`);
    }
  }
  
  // Add specific local specialties if it's a food query
  if (interests.includes('food') || interests.includes('restaurant')) {
    interestQueries.push(`famous food ${region}`);
    interestQueries.push(`street food ${region}`);
  }

  console.log('Google queries to execute:', interestQueries.slice(0, 6));

  for (const query of interestQueries.slice(0, 6)) {
    try {
      console.log(`\nExecuting Google query: "${query}"`);
      
      // Build search request with location bias
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
            radius: searchRadius
          }
        };
        console.log(`Using location bias: ${targetLat}, ${targetLng} (${searchRadius/1000}km radius)`);
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
            if (allPlaces[existingIndex].source === 'instagram') {
              console.log(`Place "${place.displayName?.text}" is user's saved place, keeping as instagram`);
              allPlaces[existingIndex].relevanceScore += 20;
            } else {
              console.log(`Place "${place.displayName?.text}" already exists, marking as combined`);
              allPlaces[existingIndex].source = 'combined';
              allPlaces[existingIndex].relevanceScore += 10;
            }
            continue;
          }

          // Calculate distance from target
          let distanceFromTarget: number | undefined;
          if (targetLat && targetLng && place.location) {
            distanceFromTarget = calculateDistance(
              targetLat, targetLng,
              place.location.latitude || 0,
              place.location.longitude || 0
            );
          }

          // Only include Google places within the search radius
          if (distanceFromTarget !== undefined && distanceFromTarget > (searchRadius / 1000)) {
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
            }, interests, 'google', distanceFromTarget, priorityPlaceTypes),
            photoReference: place.photos?.[0]?.name
          };

          console.log(`Adding Google place: "${placeData.placeName}" (score: ${placeData.relevanceScore}, distance: ${distanceFromTarget?.toFixed(2)}km)`);
          allPlaces.push(placeData);
        }
      }
    } catch (error) {
      console.error(`Error searching for "${query}":`, error);
    }
  }

  console.log('\n=== DISCOVERY: Deduplicating and sorting ===');
  console.log('Total places before deduplication:', allPlaces.length);

  const deduplicatedPlaces = deduplicatePlaces(allPlaces);
  console.log('Places after deduplication:', deduplicatedPlaces.length);
  
  // Sort by relevance score (highest first)
  deduplicatedPlaces.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const finalPlaces = deduplicatedPlaces.slice(0, limit);
  
  console.log('\n=== DISCOVERY: Final results ===');
  console.log('Returning', finalPlaces.length, 'places');
  
  if (priorityPlaceTypes.length > 0) {
    const priorityCount = finalPlaces.filter(p => {
      const placeType = p.placeType.toLowerCase();
      const placeName = p.placeName.toLowerCase();
      return priorityPlaceTypes.some(pt => placeType.includes(pt.toLowerCase()) || placeName.includes(pt.toLowerCase()));
    }).length;
    console.log(`✅ Priority places (${priorityPlaceTypes.join(', ')}): ${priorityCount}/${finalPlaces.length}`);
  }
  
  console.log('\nTop 10 places by relevance:');
  finalPlaces.slice(0, 10).forEach((p, i) => {
    const isPriority = priorityPlaceTypes.some(pt => 
      p.placeType.toLowerCase().includes(pt.toLowerCase()) || 
      p.placeName.toLowerCase().includes(pt.toLowerCase())
    );
    const marker = isPriority ? '🎯' : '  ';
    console.log(`  ${marker} ${i + 1}. ${p.placeName} (${p.placeType}, ${p.source}, score: ${p.relevanceScore})`);
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
