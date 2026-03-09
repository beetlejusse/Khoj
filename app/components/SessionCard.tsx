"use client";

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    destination: string;
    destinationImage?: string | null;
    status: string;
    approvedPlacesCount: number;
    startDate?: Date | null;
    finalizedAt: Date | null;
    updatedAt: Date;
    previewImage?: string | null;
    itemsCount?: number;
  };
  onClick: () => void;
}

export default function SessionCard({ session, onClick }: SessionCardProps) {
  const isFinalized = session.status === "finalized";

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return formatDate(date);
  };

  const getStatusText = () => {
    if (isFinalized) {
      if (session.startDate) {
        return `Upcoming trip starting soon on ${formatDate(session.startDate)}`;
      }
      return "Upcoming trip - planned whenever you're ready";
    }
    if (session.approvedPlacesCount > 0) {
      return `${session.approvedPlacesCount} ${session.approvedPlacesCount === 1 ? "place" : "places"} selected`;
    }
    return "Just started";
  };

  const cardImage = session.destinationImage || session.previewImage;

  return (
    <div
      onClick={onClick}
      className={`glass-effect rounded-2xl overflow-hidden cursor-pointer hover-lift smooth-transition h-80 flex flex-col group relative ${
        isFinalized ? 'border-orange-400/30' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 smooth-transition pointer-events-none" />
      
      <div
        className="h-44 flex flex-col justify-between p-4 relative overflow-hidden"
        style={{
          backgroundImage: cardImage
            ? `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${cardImage})`
            : "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex justify-end">
          {isFinalized && (
            <div className="glass-effect px-3 py-1.5 rounded-lg text-xs font-semibold text-orange-400 border border-orange-400/30">
              ✓ Finalized
            </div>
          )}
        </div>

        <div>
          <div className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
            {session.destination}
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between relative z-10">
        <div>
          <div className="text-lg font-bold mb-2 text-white">
            {session.title}
          </div>

          <div className="text-sm text-muted-foreground leading-relaxed">
            {getStatusText()}
            {!isFinalized && (
              <span> • Updated {getTimeAgo(session.updatedAt)}</span>
            )}
          </div>
        </div>

        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 group-hover:text-white smooth-transition">
          <span>{isFinalized ? "View Itinerary" : "Continue Planning"}</span>
          <span className="group-hover:translate-x-1 smooth-transition">→</span>
        </div>
      </div>
    </div>
  );
}
