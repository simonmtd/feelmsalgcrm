const AVATAR_TONES = [
  "bg-brand-soft text-fg",
  "bg-success-soft text-fg",
  "bg-info-soft text-fg",
  "bg-surface-3 text-fg",
  "bg-violet-soft text-fg",
];

export function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 997;
  return hash;
}

export function avatarToneFor(id: string) {
  return AVATAR_TONES[hashString(id) % AVATAR_TONES.length];
}

export function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
