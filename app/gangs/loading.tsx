export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-900 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-neutral-800 animate-pulse rounded-xl h-32"
          />
        ))}
      </div>
    </div>
  );
}