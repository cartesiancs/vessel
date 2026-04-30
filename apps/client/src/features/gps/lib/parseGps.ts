export const parseGpsState = (
  state: string | null | undefined,
): [number, number] | null => {
  if (!state) return null;

  const latMatch = state.match(/lat=([-\d.]+)/);
  const lngMatch = state.match(/lng=([-\d.]+)/);

  if (latMatch && lngMatch && latMatch[1] && lngMatch[1]) {
    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lngMatch[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }
  return null;
};
