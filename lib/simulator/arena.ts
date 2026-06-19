import Matter from "matter-js"
import { createArenaBounds, createObstacle, createCircularObstacle } from "./physics"

export interface ArenaConfig {
  id: string
  name: string
  description: string
  width: number
  height: number
  robotStartX: number
  robotStartY: number
  robotStartAngle: number
  lineTrack?: LineSegment[]
  goals?: Goal[]
}

export interface LineSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
}

export interface Goal {
  x: number
  y: number
  radius: number
  color: string
  label: string
}

export interface ArenaSetup {
  config: ArenaConfig
  obstacles: Matter.Body[]
  walls: Matter.Body[]
}

// Predefined arenas
export const ARENAS: ArenaConfig[] = [
  {
    id: "open-arena",
    name: "Open Arena",
    description: "A simple open space for testing basic movements",
    width: 800,
    height: 600,
    robotStartX: 100,
    robotStartY: 300,
    robotStartAngle: 0,
  },
  {
    id: "obstacle-course",
    name: "Obstacle Course",
    description: "Navigate around obstacles to reach the goal",
    width: 800,
    height: 600,
    robotStartX: 100,
    robotStartY: 300,
    robotStartAngle: 0,
    goals: [
      { x: 700, y: 300, radius: 40, color: "#22c55e", label: "Goal" },
    ],
  },
  {
    id: "maze",
    name: "Simple Maze",
    description: "Find your way through the maze",
    width: 800,
    height: 600,
    robotStartX: 60,
    robotStartY: 60,
    robotStartAngle: 0,
    goals: [
      { x: 740, y: 540, radius: 40, color: "#22c55e", label: "Exit" },
    ],
  },
  {
    id: "line-follow",
    name: "Line Following Track",
    description: "Follow the black line from start to finish",
    width: 800,
    height: 600,
    robotStartX: 100,
    robotStartY: 500,
    robotStartAngle: -Math.PI / 2,
    lineTrack: [
      { x1: 100, y1: 500, x2: 100, y2: 200, width: 20 },
      { x1: 100, y1: 200, x2: 300, y2: 200, width: 20 },
      { x1: 300, y1: 200, x2: 300, y2: 400, width: 20 },
      { x1: 300, y1: 400, x2: 500, y2: 400, width: 20 },
      { x1: 500, y1: 400, x2: 500, y2: 100, width: 20 },
      { x1: 500, y1: 100, x2: 700, y2: 100, width: 20 },
    ],
    goals: [
      { x: 700, y: 100, radius: 30, color: "#22c55e", label: "Finish" },
    ],
  },
]

export function setupArena(world: Matter.World, arenaId: string): ArenaSetup {
  const config = ARENAS.find((a) => a.id === arenaId) || ARENAS[0]
  const walls = createArenaBounds(world, config.width, config.height)
  const obstacles: Matter.Body[] = []

  switch (arenaId) {
    case "obstacle-course":
      obstacles.push(
        createObstacle(world, 250, 200, 80, 80),
        createObstacle(world, 400, 400, 100, 60),
        createCircularObstacle(world, 550, 250, 40),
        createObstacle(world, 300, 500, 120, 40),
        createCircularObstacle(world, 600, 450, 35),
      )
      break

    case "maze":
      // Horizontal walls
      obstacles.push(
        createObstacle(world, 200, 120, 280, 20),
        createObstacle(world, 500, 120, 200, 20),
        createObstacle(world, 150, 240, 180, 20),
        createObstacle(world, 450, 240, 300, 20),
        createObstacle(world, 250, 360, 280, 20),
        createObstacle(world, 650, 360, 100, 20),
        createObstacle(world, 100, 480, 80, 20),
        createObstacle(world, 350, 480, 300, 20),
      )
      // Vertical walls
      obstacles.push(
        createObstacle(world, 340, 60, 20, 100),
        createObstacle(world, 600, 180, 20, 100),
        createObstacle(world, 240, 180, 20, 100),
        createObstacle(world, 110, 300, 20, 100),
        createObstacle(world, 390, 300, 20, 100),
        createObstacle(world, 500, 420, 20, 100),
        createObstacle(world, 200, 420, 20, 100),
        createObstacle(world, 600, 540, 20, 100),
      )
      break

    default:
      // Open arena - no obstacles
      break
  }

  return { config, obstacles, walls }
}

export function isPointInGoal(x: number, y: number, goal: Goal): boolean {
  const dx = x - goal.x
  const dy = y - goal.y
  return Math.sqrt(dx * dx + dy * dy) <= goal.radius
}

export function isPointOnLine(
  x: number,
  y: number,
  lineTrack: LineSegment[]
): boolean {
  for (const segment of lineTrack) {
    const dist = pointToLineDistance(x, y, segment.x1, segment.y1, segment.x2, segment.y2)
    if (dist <= segment.width / 2) {
      return true
    }
  }
  return false
}

function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx, yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}


