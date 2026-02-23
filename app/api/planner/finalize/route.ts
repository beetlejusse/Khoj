import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSession, finalizeSession } from '@/app/lib/discovery/sessionManager';
import { db } from '@/app/db/db';
import { places } from '@/app/db/schema';
import { inArray } from 'drizzle-orm';
import { solveTSP } from '@/app/lib/route/tsp';
import client from '@/app/lib/googlePlaces/client';

export async function POST(req: NextRequest) {
  try {
    console.log('=== FINALIZE ENDPOINT: START ===');
    
    const { userId } = await auth();
    if (!userId) {
      console.error('FINALIZE: No userId - unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('FINALIZE: UserId:', userId);

    const { sessionId } = await req.json();
    console.log('FINALIZE: SessionId from request:', sessionId);
    
    if (!sessionId) {
      console.error('FINALIZE: No sessionId provided');
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    console.log('FINALIZE: Session found:', !!session);
    console.log('FINALIZE: Session data:', session);
    
    if (!session || session.userId !== userId) {
      console.error('FINALIZE: Session not found or unauthorized');
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    console.log('FINALIZE: Approved places:', session.approvedPlaces);
    console.log('FINALIZE: Approved places count:', session.approvedPlaces?.length);
    
    if (!session.approvedPlaces || session.approvedPlaces.length === 0) {
      console.error('FINALIZE: No places selected');
      return NextResponse.json({ error: 'No places selected' }, { status: 400 });
    }

    // Fetch place details for approved places
    console.log('FINALIZE: Fetching place details from database...');
    const approvedPlaceDetails = await db
      .select()
      .from(places)
      .where(inArray(places.placeId, session.approvedPlaces));

    console.log('FINALIZE: Place details fetched:', approvedPlaceDetails.length);
    console.log('FINALIZE: Place details:', approvedPlaceDetails.map(p => ({ id: p.placeId, name: p.displayName })));

    // Calculate optimal route using TSP
    console.log('FINALIZE: Calculating optimal route...');
    const coordinates = approvedPlaceDetails.map(p => ({ lat: p.lat, lng: p.lng }));
    console.log('FINALIZE: Coordinates:', coordinates);
    
    const optimalOrder = solveTSP(coordinates);
    console.log('FINALIZE: Optimal order:', optimalOrder);

    // Reorder places according to optimal route
    const orderedPlaces = optimalOrder.map(index => approvedPlaceDetails[index]);
    console.log('FINALIZE: Ordered places:', orderedPlaces.map(p => p.displayName));

    // Calculate distances and time estimates with actual times
    console.log('FINALIZE: Calculating itinerary items...');
    const startTime = 10; // Start at 10 AM
    let currentTime = startTime * 60; // Convert to minutes
    
    const itineraryItems = await Promise.all(orderedPlaces.map(async (place, index) => {
      console.log(`FINALIZE: Processing place ${index + 1}/${orderedPlaces.length}: ${place.displayName}`);
      let duration = 60; // Default 60 minutes
      let travelTime = 0; // Travel time to this place
      
      // Estimate duration based on place type
      if (place.type === 'restaurant' || place.type === 'cafe') duration = 90;
      else if (place.type === 'museum') duration = 120;
      else if (place.type === 'place_of_worship') duration = 45;
      else if (place.type === 'shopping_mall') duration = 120;
      else if (place.type === 'tourist_attraction') duration = 90;
      else if (place.type === 'park') duration = 60;

      let distance = 0;
      if (index > 0) {
        const prev = orderedPlaces[index - 1];
        distance = calculateDistance(prev.lat, prev.lng, place.lat, place.lng);
        
        // Calculate travel time (assume 3 km/h walking speed in city)
        travelTime = Math.ceil((distance / 3) * 60); // minutes
        if (travelTime < 5) travelTime = 5; // Minimum 5 min travel
        if (travelTime > 30) travelTime = 30; // Cap at 30 min (suggest transport)
      }

      // Add travel time to current time
      currentTime += travelTime;
      
      const arrivalTime = currentTime;
      const arrivalHour = Math.floor(arrivalTime / 60);
      const arrivalMin = arrivalTime % 60;
      
      // Add duration to current time for next place
      currentTime += duration;
      
      const departureTime = currentTime;
      const departureHour = Math.floor(departureTime / 60);
      const departureMin = departureTime % 60;

      // Fetch photo for this place
      let photoUrl = null;
      try {
        console.log(`FINALIZE: Fetching photo for ${place.displayName}...`);
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
        const [placeDetails] = await client.getPlace({
          name: `places/${place.placeId}`
        }, {
          otherArgs: {
            headers: {
              'X-Goog-FieldMask': 'photos'
            }
          }
        });
        
        if (placeDetails?.photos?.[0]?.name) {
          const photoName = placeDetails.photos[0].name;
          const requestUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`;
          const res = await fetch(requestUrl);
          photoUrl = res.url;
          console.log(`FINALIZE: Photo fetched for ${place.displayName}: ${photoUrl}`);
        } else {
          console.log(`FINALIZE: No photo available for ${place.displayName}`);
        }
      } catch (error) {
        console.error(`FINALIZE: Failed to fetch photo for ${place.displayName}:`, error);
      }

      return {
        placeId: place.placeId,
        name: place.displayName,
        type: place.type,
        lat: place.lat,
        lng: place.lng,
        address: place.formattedAddress,
        duration,
        travelTime,
        distanceFromPrevious: distance,
        sequenceOrder: index,
        arrivalTime: `${arrivalHour % 12 || 12}:${arrivalMin.toString().padStart(2, '0')} ${arrivalHour >= 12 ? 'PM' : 'AM'}`,
        departureTime: `${departureHour % 12 || 12}:${departureMin.toString().padStart(2, '0')} ${departureHour >= 12 ? 'PM' : 'AM'}`,
        timeSlot: `${arrivalHour % 12 || 12}:${arrivalMin.toString().padStart(2, '0')} ${arrivalHour >= 12 ? 'PM' : 'AM'} - ${departureHour % 12 || 12}:${departureMin.toString().padStart(2, '0')} ${departureHour >= 12 ? 'PM' : 'AM'}`,
        suggestion: getSuggestion(place.type, arrivalHour),
        photoUrl
      };
    }));

    // Calculate total time and distance
    console.log('FINALIZE: Itinerary items created:', itineraryItems.length);
    console.log('FINALIZE: First item:', itineraryItems[0]);
    
    const totalDuration = itineraryItems.reduce((sum, item) => sum + item.duration, 0);
    const totalDistance = itineraryItems.reduce((sum, item) => sum + item.distanceFromPrevious, 0);

    console.log('FINALIZE: Total duration:', totalDuration, 'minutes');
    console.log('FINALIZE: Total distance:', totalDistance.toFixed(2), 'km');

    const responseData = {
      success: true,
      itinerary: {
        sessionId: session.id,
        title: session.title,
        destination: session.destination,
        days: session.days,
        items: itineraryItems,
        totalDuration,
        totalDistance: totalDistance.toFixed(2),
        finalizedAt: new Date()
      }
    };

    // Save the finalized itinerary to database
    console.log('FINALIZE: Saving itinerary to database...');
    await finalizeSession(sessionId, responseData.itinerary);
    console.log('FINALIZE: Itinerary saved to database');

    console.log('=== FINALIZE: Sending response ===');
    console.log('FINALIZE: Response structure:', {
      success: responseData.success,
      itinerary: {
        ...responseData.itinerary,
        items: `${responseData.itinerary.items.length} items`
      }
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('=== FINALIZE: ERROR ===');
    console.error('FINALIZE: Error details:', error);
    console.error('FINALIZE: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to finalize itinerary', details: String(error) },
      { status: 500 }
    );
  }
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

function getSuggestion(placeType: string, hour: number): string {
  if (placeType === 'restaurant' || placeType === 'cafe') {
    if (hour >= 12 && hour < 15) return 'Perfect time for lunch';
    if (hour >= 18 && hour < 21) return 'Great for dinner';
    return 'Enjoy some food and drinks';
  }
  
  if (placeType === 'place_of_worship') {
    if (hour >= 10 && hour < 12) return 'Morning visit for peaceful experience';
    return 'Take time to explore and reflect';
  }
  
  if (placeType === 'shopping_mall') {
    if (hour >= 16) return 'Evening shopping before heading home';
    return 'Browse shops and relax';
  }
  
  if (placeType === 'museum' || placeType === 'tourist_attraction') {
    return 'Explore and take photos';
  }
  
  if (placeType === 'park') {
    if (hour < 12) return 'Morning walk in fresh air';
    if (hour >= 16) return 'Evening stroll';
    return 'Relax and enjoy nature';
  }
  
  return 'Enjoy your visit';
}
