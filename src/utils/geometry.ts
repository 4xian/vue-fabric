import type { Point } from '../../types'

export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

export function getMidPoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  }
}

export function getAngle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI)
}

export function isPointNear(p1: Point, p2: Point, threshold: number): boolean {
  return calculateDistance(p1, p2) < threshold
}

export function getPolygonArea(points: Point[]): number {
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

export function getPolygonCentroid(points: Point[]): Point {
  let cx = 0
  let cy = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    cx += points[i].x
    cy += points[i].y
  }

  return {
    x: cx / n,
    y: cy / n
  }
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

export function getBezierPoint(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  }
}

export function smoothCurve(points: Point[], tension = 0.5): Point[] {
  if (points.length < 2) return points

  const result: Point[] = []
  const n = points.length

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(n - 1, i + 2)]

    const cp1 = {
      x: p1.x + (p2.x - p0.x) * tension / 6,
      y: p1.y + (p2.y - p0.y) * tension / 6
    }
    const cp2 = {
      x: p2.x - (p3.x - p1.x) * tension / 6,
      y: p2.y - (p3.y - p1.y) * tension / 6
    }

    for (let t = 0; t < 1; t += 0.1) {
      result.push(getBezierPoint(t, p1, cp1, cp2, p2))
    }
  }

  result.push(points[n - 1])
  return result
}
