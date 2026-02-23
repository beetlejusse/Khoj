import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/app/db/db';
import { places } from '@/app/db/schema';
import { inArray } from 'drizzle-orm';
import client from '@/app/lib/googlePlaces/client';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { placeIds } = await req.json();
    
    if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json({ places: [] });
    }

    console.log('=== APPROVED PLACES: Fetching details ===');
    console.log('Place IDs:', placeIds);

    // Fetch place details from database
    const placeDetails = await db
      .select()
      .from(places)
      .where(inArray(places.placeId, placeIds));

    console.log('Places found in DB:', placeDetails.length);

    // Fetch photos and ratings for each place
    const placesWithDetails = await Promise.all(
      placeDetails.map(async (place) => {
        let photoUrl = null;
        let rating = 0;

        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
          const [placeData] = await client.getPlace({
            name: `places/${place.placeId}`
          }, {
            otherArgs: {
              headers: {
                'X-Goog-FieldMask': 'photos,rating'
              }
            }
          });

          if (placeData?.photos?.[0]?.name) {
            const photoName = placeData.photos[0].name;
            const requestUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`;
            const res = await fetch(requestUrl);
            photoUrl = res.url;
          }

          if (placeData?.rating) {
            rating = placeData.rating;
          }
        } catch (error) {
          console.error(`Failed to fetch details for ${place.displayName}:`, error);
        }

        return {
          placeId: place.placeId,
          name: place.displayName,
          type: place.type,
          rating,
          address: place.formattedAddress,
          source: 'instagram', // Assume user saved places
          photoUrl
        };
      })
    );

    console.log('=== APPROVED PLACES: Returning ===');
    console.log('Places with details:', placesWithDetails.length);

    return NextResponse.json({ places: placesWithDetails });

  } catch (error) {
    console.error('Approved places error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approved places' },
      { status: 500 }
    );
  }
}
