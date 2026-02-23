/**
 * pathfinder.ts
 * A* grid pathfinder for Atlas navigation.
 *
 * Grid: 1m cells covering the terrain. Each cell is:
 *   0 = free
 *   1 = blocked (solid wall / tree / rock etc.)
 *   2 = climbable (log) — traversable but Atlas should jump
 */

import type { ColliderBox, Vec3 } from './simulationStore';

export type GridCell = 0 | 1 | 2;

export interface PathGrid {
    cells: Uint8Array;
    size: number;   // width == height (square)
    origin: number; // world offset: worldX = cellX - origin
}

// ── Build grid from current collider set ──────────────────────────────────────
export function buildGrid(colliders: ColliderBox[], terrainSize: number): PathGrid {
    const size = terrainSize + 4; // slight border
    const origin = Math.floor(size / 2); // cell (origin, origin) == world (0,0)
    const cells = new Uint8Array(size * size); // all free

    for (const c of colliders) {
        // Determine passability
        let cellValue: GridCell = 0;
        if (c.climbable || c.type === 'log') {
            cellValue = 2; // climbable
        } else if (
            c.type === 'structure' || c.type === 'building' ||
            c.type === 'boundary' || c.type === 'tree' || c.type === 'rock' ||
            (c.type === 'door' && c.metadata?.state !== 'open')
        ) {
            cellValue = 1; // blocked
        } else if (c.type === 'portal') {
            cellValue = 0; // always passable
        } else {
            continue; // chairs, tables, toys — passable
        }

        // Mark cells covered by this collider's footprint (+ a small margin for solids)
        const margin = cellValue === 1 ? 0.4 : 0;
        const minX = Math.floor(c.position.x - c.size.x / 2 - margin);
        const maxX = Math.ceil(c.position.x + c.size.x / 2 + margin);
        const minZ = Math.floor(c.position.z - c.size.z / 2 - margin);
        const maxZ = Math.ceil(c.position.z + c.size.z / 2 + margin);

        for (let wx = minX; wx <= maxX; wx++) {
            for (let wz = minZ; wz <= maxZ; wz++) {
                const cx = wx + origin;
                const cz = wz + origin;
                if (cx >= 0 && cx < size && cz >= 0 && cz < size) {
                    const idx = cz * size + cx;
                    // Don't overwrite blocked with climbable
                    if (cellValue === 1 || cells[idx] === 0) {
                        cells[idx] = cellValue;
                    }
                }
            }
        }
    }

    return { cells, size, origin };
}

// ── A* ────────────────────────────────────────────────────────────────────────
interface ANode {
    cx: number; cz: number;
    g: number; f: number;
    parent: ANode | null;
}

function heuristic(ax: number, az: number, bx: number, bz: number) {
    return Math.abs(ax - bx) + Math.abs(az - bz); // Manhattan
}

export function astar(grid: PathGrid, from: Vec3, to: Vec3): Vec3[] {
    const { cells, size, origin } = grid;

    const startCX = Math.round(from.x) + origin;
    const startCZ = Math.round(from.z) + origin;
    let endCX = Math.round(to.x) + origin;
    let endCZ = Math.round(to.z) + origin;

    // Clamp to grid
    const clamp = (v: number) => Math.max(0, Math.min(size - 1, v));
    const sCX = clamp(startCX), sCZ = clamp(startCZ);
    let eCX = clamp(endCX), eCZ = clamp(endCZ);

    // If destination cell is blocked, find the nearest free neighbor
    if (cells[eCZ * size + eCX] === 1) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (let r = 1; r <= 5; r++) {
            let found = false;
            for (const [dx, dz] of dirs) {
                const nx = clamp(eCX + dx * r), nz = clamp(eCZ + dz * r);
                if (cells[nz * size + nx] !== 1) { eCX = nx; eCZ = nz; found = true; break; }
            }
            if (found) break;
        }
    }

    // Early out — start == end
    if (sCX === eCX && sCZ === eCZ) return [to];

    const open = new Map<number, ANode>();
    const closed = new Set<number>();
    const key = (x: number, z: number) => z * size + x;

    const startNode: ANode = { cx: sCX, cz: sCZ, g: 0, f: heuristic(sCX, sCZ, eCX, eCZ), parent: null };
    open.set(key(sCX, sCZ), startNode);

    const DIRS_8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];

    let iterations = 0;
    while (open.size > 0 && iterations < 8000) {
        iterations++;

        // Pick node with lowest f
        let current: ANode | null = null;
        for (const node of open.values()) {
            if (!current || node.f < current.f) current = node;
        }
        if (!current) break;

        if (current.cx === eCX && current.cz === eCZ) {
            // Reconstruct path
            const rawPath: Vec3[] = [];
            let n: ANode | null = current;
            while (n) {
                rawPath.unshift({ x: n.cx - origin, y: 0, z: n.cz - origin });
                n = n.parent;
            }
            return smoothPath(rawPath);
        }

        open.delete(key(current.cx, current.cz));
        closed.add(key(current.cx, current.cz));

        for (const [dx, dz] of DIRS_8) {
            const nx = current.cx + dx, nz = current.cz + dz;
            if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
            const k = key(nx, nz);
            if (closed.has(k)) continue;
            const cell = cells[nz * size + nx];
            if (cell === 1) continue; // blocked

            const moveCost = (dx !== 0 && dz !== 0) ? 1.414 : 1;
            const climbPenalty = cell === 2 ? 2 : 0; // slight penalty for logs
            const g = current.g + moveCost + climbPenalty;
            const existing = open.get(k);
            if (!existing || g < existing.g) {
                const node: ANode = { cx: nx, cz: nz, g, f: g + heuristic(nx, nz, eCX, eCZ), parent: current };
                open.set(k, node);
            }
        }
    }

    // Fallback: direct line
    return [to];
}

// ── Path smoothing ─────────────────────────────────────────────────────────────
// Remove intermediate collinear points; keeps corners and climbable cells.
function smoothPath(path: Vec3[]): Vec3[] {
    if (path.length <= 2) return path;
    const result: Vec3[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const prev = result[result.length - 1];
        const curr = path[i];
        const next = path[i + 1];
        const dx1 = curr.x - prev.x, dz1 = curr.z - prev.z;
        const dx2 = next.x - curr.x, dz2 = next.z - curr.z;
        // Keep if direction changes
        if (dx1 !== dx2 || dz1 !== dz2) result.push(curr);
    }
    result.push(path[path.length - 1]);
    return result;
}

// ── Climbable check ────────────────────────────────────────────────────────────
// Returns true if the waypoint being moved toward sits on a climbable cell
export function isClimbableWaypoint(wp: Vec3, grid: PathGrid): boolean {
    const cx = Math.round(wp.x) + grid.origin;
    const cz = Math.round(wp.z) + grid.origin;
    if (cx < 0 || cx >= grid.size || cz < 0 || cz >= grid.size) return false;
    return grid.cells[cz * grid.size + cx] === 2;
}
