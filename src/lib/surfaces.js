const LEGACY_SURFACE_NAME_TO_ID = {
  "1": "1",
  "1/2": "2",
  "1/4": "3",
  "1/8": "4",
};

export function normalizeSurfaceValue(surfaceValue) {
  const rawValue = String(surfaceValue || "").trim();
  if (!rawValue) {
    return "";
  }

  if (/^\d+$/.test(rawValue)) {
    return rawValue;
  }

  return LEGACY_SURFACE_NAME_TO_ID[rawValue] || "";
}

export function parseSurfaceId(surfaceValue) {
  const normalizedId = normalizeSurfaceValue(surfaceValue);
  if (!normalizedId) {
    return null;
  }

  const parsedId = Number.parseInt(normalizedId, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
}

export function getSurfaceById(surfaceId, surfaces = []) {
  const normalizedId = normalizeSurfaceValue(surfaceId);
  return surfaces.find((surface) => String(surface.id) === normalizedId) || null;
}