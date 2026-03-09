"use client";

interface NewTripCardProps {
  onClick: () => void;
}

export default function NewTripCard({ onClick }: NewTripCardProps) {
  return (
    <div
      onClick={onClick}
      className="glass-effect rounded-2xl p-6 cursor-pointer hover-lift smooth-transition max-w-2xl mx-auto group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 smooth-transition" />
      
      <div className="relative flex items-center gap-5">
        <div className="text-4xl group-hover:scale-110 smooth-transition">✨</div>
        <div className="flex-1">
          <div className="text-xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Start a New Adventure
          </div>
          <div className="text-sm text-muted-foreground">
            Let AI help you plan the perfect itinerary
          </div>
        </div>
        <div className="text-2xl opacity-50 group-hover:opacity-100 group-hover:translate-x-1 smooth-transition">
          →
        </div>
      </div>
    </div>
  );
}
