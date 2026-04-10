import type { ColliderBox } from '@/lib/simulationStore';
import { CANONICAL_FETCH_OBJECT_NAMES } from '@/lib/worldContext';

function normalize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Match LLM/user phrasing to a fetchable toy collider. Prefer exact canonical names; fall back to color+shape keywords.
 */
export function resolveFetchToyCollider(
    colliders: ColliderBox[],
    rawName: string | undefined
): ColliderBox | undefined {
    if (!rawName || typeof rawName !== 'string') return undefined;

    const toys = colliders.filter(c => c.type === 'toy' && c.metadata?.fetchable);
    if (toys.length === 0) return undefined;

    const n = normalize(rawName);

    const canonical = (c: ColliderBox) =>
        `${c.metadata!.colorName} ${c.metadata!.shape}`.toLowerCase();

    let hit = toys.find(c => canonical(c) === n);
    if (hit) return hit;

    // Common LLM variants
    hit = toys.find(c => canonical(c) === n.replace(/^the /, '').replace(/^a /, '').replace(/^an /, ''));
    if (hit) return hit;

    // id match: "toy-cube", "cube toy"
    hit = toys.find(c => {
        const short = c.id.replace(/^toy-/, '');
        return n.includes(short) || n.replace(/\s/g, '') === c.id.replace(/-/g, '');
    });
    if (hit) return hit;

    // Keyword: require color AND shape when possible
    for (const c of toys) {
        const color = c.metadata!.colorName!.toLowerCase();
        const shape = c.metadata!.shape!;
        if (n.includes(color) && n.includes(shape)) return c;
    }

    // Single-shape disambiguation (e.g. "the cube" → only one cube)
    for (const shape of ['cube', 'sphere', 'pyramid'] as const) {
        if (!n.includes(shape)) continue;
        const withShape = toys.filter(c => c.metadata?.shape === shape);
        if (withShape.length === 1) return withShape[0];
    }

    // Last resort: fuzzy match against canonical list order
    for (const canon of CANONICAL_FETCH_OBJECT_NAMES) {
        if (n.includes(canon.split(' ')[0]) && n.includes(canon.split(' ')[1])) {
            hit = toys.find(c => canonical(c) === canon);
            if (hit) return hit;
        }
    }

    return undefined;
}
