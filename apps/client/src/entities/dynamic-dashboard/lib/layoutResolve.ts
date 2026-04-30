import type { DashboardGroup, DashboardItem } from "../model/store";

/** Clamp top-left grid position to group bounds (matches store behavior). */
export function clampItemPosition(
  group: DashboardGroup,
  size: { w: number; h: number },
  position: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, group.cols - size.w)),
    y: Math.min(Math.max(0, position.y), Math.max(0, group.rows - size.h)),
  };
}

export function itemsCollide(
  a: Pick<DashboardItem, "position" | "size">,
  b: Pick<DashboardItem, "position" | "size">,
): boolean {
  return (
    a.position.x < b.position.x + b.size.w &&
    a.position.x + a.size.w > b.position.x &&
    a.position.y < b.position.y + b.size.h &&
    a.position.y + a.size.h > b.position.y
  );
}

/**
 * Pointer/grid intent → clamped position if it does not overlap other items.
 * Returns null if the move is blocked by collision (keep previous preview).
 */
export function resolveItemPositionOrNull(
  group: DashboardGroup,
  movingItem: DashboardItem,
  desiredPosition: { x: number; y: number },
): { x: number; y: number } | null {
  const nextPos = clampItemPosition(group, movingItem.size, desiredPosition);
  const candidate = { ...movingItem, position: nextPos };
  const collides = group.items.some(
    (other) => other.id !== movingItem.id && itemsCollide(candidate, other),
  );
  if (collides) return null;
  return nextPos;
}
