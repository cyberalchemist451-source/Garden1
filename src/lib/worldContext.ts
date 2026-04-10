/**
 * Single source of truth for picnic / fetch landmarks (keep in sync with PicnicArea placement).
 */

export const PICNIC_TABLE_X = 25;
export const PICNIC_TABLE_Z = 28;
export const OBSTACLE_LOG_X = 22;
export const OBSTACLE_LOG_Z = 18;

/** Cabin / structure area (approx), north of picnic */
export const CABIN_AREA = { x: 25, z: 7 };

export const PICNIC_TOY_OFFSETS = [
    { id: 'toy-sphere', shape: 'sphere' as const, colorName: 'red', color: '#ef4444', ox: -1.2, oz: 0.2 },
    { id: 'toy-cube', shape: 'cube' as const, colorName: 'blue', color: '#3b82f6', ox: 0.0, oz: 0.3 },
    { id: 'toy-pyramid', shape: 'pyramid' as const, colorName: 'yellow', color: '#eab308', ox: 1.2, oz: 0.1 },
] as const;

/** Canonical strings the fetch executor matches (after normalization). */
export const CANONICAL_FETCH_OBJECT_NAMES = ['red sphere', 'blue cube', 'yellow pyramid'] as const;

export function buildAtlasWorldPromptSection(): string {
    return `
WORLD MAP (fixed coordinates on XZ plane, Y is height — use for search/navigation when sensors omit objects):
- Atlas default spawn: ~(0, 0)
- Cabin / building: ~(${CABIN_AREA.x}, ${CABIN_AREA.z})
- Picnic table (wooden table + benches): ~(${PICNIC_TABLE_X}, ${PICNIC_TABLE_Z}) — roughly 18–22m south/southeast of cabin; three small toys sit ON the table: red sphere, blue cube, yellow pyramid
- Fallen log obstacle: ~(${OBSTACLE_LOG_X}, ${OBSTACLE_LOG_Z}) — between spawn and picnic, useful landmark when moving toward the table

SENSORS: The "nearby" list is only objects inside a ~60° forward vision cone and ≤60m away. Toys behind Atlas or far off-axis may be MISSING until the robot turns or moves toward ~(${PICNIC_TABLE_X}, ${PICNIC_TABLE_Z}).

FETCH COMMAND: For type "fetch", parameters.objectName MUST be EXACTLY one of: "red sphere" | "blue cube" | "yellow pyramid" (color then shape, lowercase). If the user asks for the blue cube / toy on the picnic table, navigate toward the picnic coordinates first if needed, then call fetch with objectName "blue cube".

TASK SEARCH: When an object is required for a task but not in the nearby list, use CONTEXT above to plan movement toward the likely region (e.g. picnic table) before issuing fetch.`;
}

export interface SceneFetchableToy {
    id: string;
    objectName: string;
    position: { x: number; z: number };
}
