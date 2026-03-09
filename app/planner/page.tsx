"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import axios from "axios";
import SessionCard from "@/app/components/SessionCard";
import NewTripCard from "@/app/components/NewTripCard";

interface Session {
  id: string;
  title: string;
  destination: string;
  destinationImage?: string | null;
  status: string;
  approvedPlacesCount: number;
  startDate?: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  previewImage?: string | null;
  itemsCount?: number;
}

export default function PlannerHomePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth");
      return;
    }

    if (isLoaded && isSignedIn) {
      fetchSessions();
    }
  }, [isLoaded, isSignedIn, router]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/planner/sessions");
      setSessions(response.data.sessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewTrip = async () => {
    if (creatingSession) return;

    try {
      setCreatingSession(true);
      const response = await axios.post("/api/planner/session", {
        userId: user?.id,
        destination: "New Trip",
        interests: [],
      });

      router.push(`/planner/${response.data.sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      setCreatingSession(false);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/planner/${sessionId}`);
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-effect px-8 py-4 rounded-xl">
          <span className="animate-pulse">Loading...</span>
        </div>
      </div>
    );
  }

  const finalizedSessions = sessions.filter((s) => s.status === "finalized");
  const inProgressSessions = sessions.filter((s) => s.status !== "finalized");

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10">
        <div className="glass-effect border-b border-white/10 mb-8">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Trip Planner
            </h1>
            <p className="text-lg text-muted-foreground">
              Plan your perfect journey with AI assistance
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 pb-12">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="glass-effect px-8 py-4 rounded-xl">
                <span className="animate-pulse">Loading your trips...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-12 animate-fade-in">
                <NewTripCard onClick={handleStartNewTrip} />
              </div>

              {sessions.length === 0 && (
                <div className="glass-effect rounded-2xl p-12 text-center animate-scale-in">
                  <div className="text-6xl mb-4 opacity-50">✈️</div>
                  <div className="text-2xl font-bold mb-3">No trips yet</div>
                  <div className="text-muted-foreground">
                    Start planning your first adventure by clicking the card above
                  </div>
                </div>
              )}

              {finalizedSessions.length > 0 && (
                <div className="mb-12 animate-slide-in">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Your Upcoming Trips</h2>
                    <p className="text-sm text-muted-foreground">
                      Ready to go • {finalizedSessions.length}{" "}
                      {finalizedSessions.length === 1 ? "trip" : "trips"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {finalizedSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onClick={() => handleSessionClick(session.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inProgressSessions.length > 0 && (
                <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Continue Planning</h2>
                    <p className="text-sm text-muted-foreground">
                      In progress • {inProgressSessions.length}{" "}
                      {inProgressSessions.length === 1 ? "trip" : "trips"}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inProgressSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        onClick={() => handleSessionClick(session.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
