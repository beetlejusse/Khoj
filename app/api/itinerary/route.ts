import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/app/db/db';
import { sql } from 'drizzle-orm';
import { optimizeRoute } from '@/app/lib/route/tsp';

const VISIT_DURATIONS: Record<string, number> = {
  restaurant: 60,
  cafe: 30,
  museum: 90,
  park: 60,
  shopping_mall: 90,
  tourist_attraction: 45,
  default: 45
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { placeIds, startTime } = await req.json();

    if (!placeIds || placeIds.length < 2) {
      return NextResponse.json({ error: 'Select at least 2 places' }, { status: 400 });
    }

    if (placeIds.length > 8) {
      return NextResponse.json({ error: 'Maximum 8 places allowed' }, { status: 400 });
    }

    // Fetch place details
    const places = await db.execute(sql`
      SELECT place_id, display_name, lat, lng, type
      FROM places
      WHERE place_id = ANY(${sql.raw(`ARRAY[${placeIds.map((id: string) => `'${id}'`).join(',')}]`)})
    `);

    // Build distance matrix
    const distanceMatrix: Record<string, Record<string, number>> = {};
    for (const p1 of places.rows) {
      distanceMatrix[p1.place_id as string] = {};
      for (const p2 of places.rows) {
        if (p1.place_id === p2.place_id) {
          distanceMatrix[p1.place_id as string][p2.place_id as string] = 0;
        } else {
          const result = await db.execute(sql`
            SELECT ST_Distance(
              (SELECT location FROM places WHERE place_id = ${p1.place_id}),
              (SELECT location FROM places WHERE place_id = ${p2.place_id}),
              true
            ) as distance
          `);
          distanceMatrix[p1.place_id as string][p2.place_id as string] = result.rows[0]?.distance as number || 0;
        }
      }
    }

    // Optimize route
    const optimizedOrder = optimizeRoute(placeIds, distanceMatrix);

    // Generate timeline
    const timeline = [];
    let currentTime = startTime || '09:00';
    let totalDistance = 0;

    for (let i = 0; i < optimizedOrder.length; i++) {
      const placeId = optimizedOrder[i];
      const place = places.rows.find((p: any) => p.place_id === placeId);
      const visitDuration = VISIT_DURATIONS[place?.type as string] || VISIT_DURATIONS.default;

      timeline.push({
        type: 'visit',
        placeId: place?.place_id,
        placeName: place?.display_name,
        arrivalTime: currentTime,
        departureTime: addMinutes(currentTime, visitDuration),
        visitDuration,
        placeType: place?.type
      });

      currentTime = addMinutes(currentTime, visitDuration);

      if (i < optimizedOrder.length - 1) {
        const nextPlaceId = optimizedOrder[i + 1];
        const distance = distanceMatrix[placeId][nextPlaceId];
        const travelDuration = Math.ceil(distance / 1000 * 3); // ~3 min per km
        totalDistance += distance;

        timeline.push({
          type: 'travel',
          distance: Math.round(distance),
          duration: travelDuration,
          startTime: currentTime,
          endTime: addMinutes(currentTime, travelDuration)
        });

        currentTime = addMinutes(currentTime, travelDuration + 10); // 10 min buffer
      }
    }

    const totalTime = calculateTotalMinutes(startTime || '09:00', currentTime);

    return NextResponse.json({
      route: optimizedOrder,
      timeline,
      totalDistance: Math.round(totalDistance),
      totalTime,
      endTime: currentTime
    });

  } catch (error) {
    console.error('Error generating itinerary:', error);
    return NextResponse.json({ error: 'Failed to generate itinerary' }, { status: 500 });
  }
}

function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

function calculateTotalMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}
