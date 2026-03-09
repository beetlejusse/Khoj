import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/db/db';
import { userReels, reelMetadata } from '@/app/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's reels with validation status
    // Ordered by most recently saved first
    const userReelsData = await db
      .select({
        shortCode: reelMetadata.shortCode,
        url: reelMetadata.url,
        caption: reelMetadata.caption,
        thumbnail: reelMetadata.thumbnail,
        savedAt: userReels.savedAt,
        validation: reelMetadata.validation,
        placeId: reelMetadata.place_id,
      })
      .from(userReels)
      .innerJoin(reelMetadata, eq(userReels.shortCode, reelMetadata.shortCode))
      .where(eq(userReels.userId, userId))
      .orderBy(desc(userReels.savedAt));

    return NextResponse.json(userReelsData);

  } catch (error) {
    console.error('Failed to fetch user reels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reels' },
      { status: 500 }
    );
  }
}
