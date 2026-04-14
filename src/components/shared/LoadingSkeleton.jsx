export function LoadingSkeleton({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-jarvis-ghost animate-shimmer"
          style={{ width: `${85 - i * 15}%`, animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }) {
  return (
    <div className={`glass p-5 ${className}`}>
      <div className="h-2 w-20 rounded-full bg-jarvis-ghost animate-shimmer mb-4" />
      <LoadingSkeleton lines={3} />
    </div>
  );
}
