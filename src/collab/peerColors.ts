export const PEER_COLORS = [
  { background: '#ff6b6b', stroke: '#c92a2a' },  // red
  { background: '#51cf66', stroke: '#2b8a3e' },  // green
  { background: '#339af0', stroke: '#1864ab' },  // blue
  { background: '#fcc419', stroke: '#e67700' },  // yellow
  { background: '#cc5de8', stroke: '#862e9c' },  // purple
  { background: '#ff922b', stroke: '#d9480f' },  // orange
  { background: '#22b8cf', stroke: '#0b7285' },  // teal
  { background: '#f06595', stroke: '#a61e4d' },  // pink
];

export function getPeerColor(index: number) {
  return PEER_COLORS[index % PEER_COLORS.length];
}

export function getPeerLabel(index: number) {
  return `User ${index + 1}`;
}

/** Deterministic hash of a clientId to a color index.
 *  Ensures the same peer gets the same color from every viewer's perspective. */
export function hashClientIdToColorIndex(clientId: string): number {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash + clientId.charCodeAt(i)) | 0;
  }
  return ((hash % PEER_COLORS.length) + PEER_COLORS.length) % PEER_COLORS.length;
}
