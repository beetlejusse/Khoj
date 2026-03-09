"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import axios from "axios";
import { UserReelWithPlace } from "../types";
import Link from "next/link";

export default function ProfilePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [reels, setReels] = useState<UserReelWithPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.href = "/auth";
      return;
    }

    async function fetchReels() {
      try {
        const response = await axios.get("/api/user/reels");
        setReels(response.data);
      } catch (error) {
        console.error("Failed to fetch reels:", error);
      }
      setLoading(false);
    }

    if (isLoaded && isSignedIn) {
      fetchReels();
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass-effect px-8 py-4 rounded-xl">
          <span className="animate-pulse">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in">
      <div className="glass-effect rounded-2xl p-6 mb-8 hover-lift">
        <div className="flex gap-5 items-center">
          <div className="relative">
            <img
              src={user?.imageUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full border-4 border-purple-400/30 shadow-xl"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-background" />
          </div>
          <div>
            <div className="text-2xl font-bold mb-1">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Link
          href="/map"
          className="glass-effect rounded-2xl p-6 hover-lift smooth-transition group"
        >
          <div className="text-4xl mb-3 group-hover:scale-110 smooth-transition">🗺️</div>
          <div className="text-xl font-bold mb-2">Explore Map</div>
          <div className="text-sm text-muted-foreground">
            View all your saved places on an interactive map
          </div>
        </Link>
        
        <Link
          href="/planner"
          className="glass-effect rounded-2xl p-6 hover-lift smooth-transition group"
        >
          <div className="text-4xl mb-3 group-hover:scale-110 smooth-transition">✈️</div>
          <div className="text-xl font-bold mb-2">Plan Trip</div>
          <div className="text-sm text-muted-foreground">
            Create perfect itineraries with AI assistance
          </div>
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Saved Reels</h2>
        <p className="text-muted-foreground">Your collection of travel inspiration</p>
      </div>

      {reels.length === 0 ? (
        <div className="glass-effect rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4 opacity-50">📸</div>
          <div className="text-xl font-bold mb-3">No reels saved yet</div>
          <p className="text-muted-foreground mb-6">
            Start saving Instagram reels to build your travel collection
          </p>
          <Link
            href="/"
            className="inline-block glass-effect px-6 py-3 rounded-xl hover:bg-white/10 smooth-transition font-medium"
          >
            Save Your First Reel
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {reels.map((reel) => (
            <div
              key={reel.shortCode}
              className="glass-effect rounded-2xl overflow-hidden hover-lift smooth-transition group"
            >
              <a
                href={reel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative"
              >
                <img
                  src={reel.thumbnail || "/reel-thumbnail-placeholder.jpg"}
                  alt="Reel"
                  className="w-full aspect-[9/16] object-cover group-hover:scale-105 smooth-transition"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/reel-thumbnail-placeholder.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 smooth-transition" />
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 smooth-transition">
                  <div className="text-white text-sm font-medium">
                    {reel.validation ? "📍 Location Found" : "No Location"}
                  </div>
                </div>
              </a>
              
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {reel.caption || "No caption"}
                </p>
                {reel.validation && reel.placeId && (
                  <Link
                    href={`/map?place=${reel.placeId}`}
                    className="block text-center glass-effect px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 smooth-transition"
                  >
                    View on Map →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
