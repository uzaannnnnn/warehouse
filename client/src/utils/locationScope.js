function normalize(str) {
  return String(str || "").trim().toUpperCase();
}

export function scopeLocationsForUser(user, locationType, options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  const isManager = user?.role === "manager" || user?.role === "admin";
  if (isManager || !list.length) return list;

  const userLoc = normalize(user?.location);
  if (!userLoc) return list;

  const effectiveType = locationType || user?.role;
  if (!effectiveType) return list;

  const exact = list.find((loc) => normalize(loc) === userLoc);
  if (exact) return [exact];
  const partial = list.find((loc) => normalize(loc).includes(userLoc));
  if (partial) return [partial];
  return [userLoc];
}

export function buildScopedLocationOptions(user, locationType, options, extra = []) {
  const base = Array.isArray(options) ? options.filter(Boolean) : [];
  const extras = Array.isArray(extra) ? extra.filter(Boolean) : [];
  const merged = new Set([...base, ...extras]);
  const userLoc = normalize(user?.location);
  if (userLoc) merged.add(userLoc);
  return scopeLocationsForUser(user, locationType, Array.from(merged));
}

export function pickInitialLocation(storageKey, options, preferred) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  if (!list.length) return "";

  const pref = normalize(preferred);
  if (pref) {
    const exact = list.find((loc) => normalize(loc) === pref);
    if (exact) return exact;
    const partial = list.find((loc) => normalize(loc).includes(pref));
    if (partial) return partial;
  }

  if (typeof window === "undefined") return list[0];
  const saved = storageKey ? window.localStorage.getItem(storageKey) : null;
  if (saved && list.includes(saved)) return saved;
  return list[0];
}
