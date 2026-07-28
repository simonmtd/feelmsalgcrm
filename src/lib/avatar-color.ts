const AVATAR_TONES = [
  "bg-gold-400 text-ink",
  "bg-forest-400 text-ink",
  "bg-himmel-300 text-ink",
  "bg-wood-200 text-wood-900",
  "bg-purple-300 text-ink",
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
