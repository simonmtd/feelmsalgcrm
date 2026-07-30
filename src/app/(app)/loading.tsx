export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-sm border-2 border-ink bg-wood-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border-2 border-ink bg-parchment shadow-[4px_4px_0_0_var(--color-ink)]"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border-2 border-ink bg-parchment shadow-[4px_4px_0_0_var(--color-ink)]" />
    </div>
  );
}
