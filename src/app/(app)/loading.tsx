export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-md border border-line bg-surface-3" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-line bg-surface "
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface " />
    </div>
  );
}
