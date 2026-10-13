// The route on the painted map (docs/rules/world.md R-WORLD-015, R-WORLD-017): from where the player stands to the stop
// picked along the roads and over the bridges, drawn as a dotted yellow line with a danfo on it; on the card when the
// stop is in the same neighbourhood, across the city on the strip, and on the open map whenever it is open.
import type { Point } from "./fit";
import { ROADS, type Road } from "./geometry";

export interface Graph {
  nodes: Point[];
  /** For each node, its neighbours and the whole-unit length to each. */
  links: { to: number; length: number }[][];
}

const keyOf = ([x, y]: Point): string => `${String(x)},${String(y)}`;

/** The roads as a graph: a node at every point of a road, roads joined where they share a point. */
export function buildGraph(roads: readonly Road[] = ROADS): Graph {
  const index = new Map<string, number>();
  const nodes: Point[] = [];
  const links: { to: number; length: number }[][] = [];
  const nodeOf = (point: Point): number => {
    const key = keyOf(point);
    const found = index.get(key);
    if (found !== undefined) return found;
    index.set(key, nodes.length);
    nodes.push(point);
    links.push([]);
    return nodes.length - 1;
  };
  for (const road of roads) {
    for (let step = 1; step < road.points.length; step += 1) {
      const a = road.points[step - 1];
      const b = road.points[step];
      if (a === undefined || b === undefined) continue;
      const from = nodeOf(a);
      const to = nodeOf(b);
      const length = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
      links[from]?.push({ to, length });
      links[to]?.push({ to: from, length });
    }
  }
  return { nodes, links };
}

/** The node nearest a point, by whole-unit squared distance; the first of equals. */
export function nearestNode(graph: Graph, [x, y]: Point): number {
  let best = -1;
  let bestGap = Number.POSITIVE_INFINITY;
  graph.nodes.forEach(([nx, ny], id) => {
    const gap = (nx - x) * (nx - x) + (ny - y) * (ny - y);
    if (gap < bestGap) {
      bestGap = gap;
      best = id;
    }
  });
  return best;
}

/** The shortest way along the roads from one point to another: the two points with the road's points between. */
export function routeBetween(graph: Graph, from: Point, to: Point): Point[] {
  const start = nearestNode(graph, from);
  const end = nearestNode(graph, to);
  if (start < 0 || end < 0 || start === end) return [from, to];
  const cost = graph.nodes.map(() => Number.POSITIVE_INFINITY);
  const back = graph.nodes.map(() => -1);
  const done = graph.nodes.map(() => false);
  cost[start] = 0;
  for (;;) {
    let node = -1;
    for (let id = 0; id < cost.length; id += 1) if (!done[id] && (node < 0 || (cost[id] ?? 0) < (cost[node] ?? 0))) node = id;
    if (node < 0 || cost[node] === Number.POSITIVE_INFINITY || node === end) break;
    done[node] = true;
    for (const { to: next, length } of graph.links[node] ?? []) {
      const through = (cost[node] ?? 0) + length;
      if (through < (cost[next] ?? 0)) {
        cost[next] = through;
        back[next] = node;
      }
    }
  }
  if (cost[end] === Number.POSITIVE_INFINITY) return [from, to];
  const path: Point[] = [];
  for (let node = end; node >= 0; node = back[node] ?? -1) path.push(graph.nodes[node] ?? from);
  path.reverse();
  return [from, ...path, to];
}

/** Where the route is drawn: on the card, on the strip, or on the open map. */
export type Channel = "card" | "strip" | "open";

/**
 * The route's channel: on the open map whenever it is open (and always on a laptop, where it never folds); folded, on
 * the card when the stop is in the neighbourhood the player stands in, else across the city on the strip.
 */
export function routeChannel({ open, wide, sameCard }: { open: boolean; wide: boolean; sameCard: boolean }): Channel {
  if (open || wide) return "open";
  return sameCard ? "card" : "strip";
}

/** The point halfway along a route by length, where its danfo stands, and the heading there in whole degrees. */
export function midway(route: readonly Point[]): { at: Point; heading: number } {
  const lengths = route.slice(1).map((point, index) => Math.hypot(point[0] - (route[index]?.[0] ?? 0), point[1] - (route[index]?.[1] ?? 0)));
  let left = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0;
    const a = route[index] ?? [0, 0];
    const b = route[index + 1] ?? a;
    if (left <= length && length > 0) {
      const share = left / length;
      return { at: [Math.round(a[0] + (b[0] - a[0]) * share), Math.round(a[1] + (b[1] - a[1]) * share)], heading: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) };
    }
    left -= length;
  }
  return { at: route[route.length - 1] ?? [0, 0], heading: 0 };
}
