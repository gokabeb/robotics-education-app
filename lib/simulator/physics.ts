import Matter from "matter-js"

export interface PhysicsWorld {
  engine: Matter.Engine
  world: Matter.World
  runner: Matter.Runner
}

export function createPhysicsWorld(): PhysicsWorld {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0 }, // Top-down view, no gravity
  })

  const world = engine.world

  const runner = Matter.Runner.create({
    delta: 1000 / 60, // 60 FPS
    isFixed: true,
  })

  return { engine, world, runner }
}

export function startPhysics(physics: PhysicsWorld): void {
  Matter.Runner.run(physics.runner, physics.engine)
}

export function stopPhysics(physics: PhysicsWorld): void {
  Matter.Runner.stop(physics.runner)
}

export function stepPhysics(physics: PhysicsWorld, delta: number = 1000 / 60): void {
  Matter.Engine.update(physics.engine, delta)
}

export function clearWorld(physics: PhysicsWorld): void {
  Matter.World.clear(physics.world, false)
  Matter.Engine.clear(physics.engine)
}

// Create arena walls
export function createArenaBounds(
  world: Matter.World,
  width: number,
  height: number,
  wallThickness: number = 20
): Matter.Body[] {
  const walls = [
    // Top wall
    Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, {
      isStatic: true,
      label: "wall-top",
      render: { fillStyle: "#3a3a40" },
    }),
    // Bottom wall
    Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, {
      isStatic: true,
      label: "wall-bottom",
      render: { fillStyle: "#3a3a40" },
    }),
    // Left wall
    Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, {
      isStatic: true,
      label: "wall-left",
      render: { fillStyle: "#3a3a40" },
    }),
    // Right wall
    Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, {
      isStatic: true,
      label: "wall-right",
      render: { fillStyle: "#3a3a40" },
    }),
  ]

  Matter.World.add(world, walls)
  return walls
}

// Create an obstacle
export function createObstacle(
  world: Matter.World,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<Matter.IBodyDefinition> = {}
): Matter.Body {
  const obstacle = Matter.Bodies.rectangle(x, y, width, height, {
    isStatic: true,
    label: "obstacle",
    render: { fillStyle: "#ef4444" },
    ...options,
  })

  Matter.World.add(world, obstacle)
  return obstacle
}

// Create a circular obstacle
export function createCircularObstacle(
  world: Matter.World,
  x: number,
  y: number,
  radius: number,
  options: Partial<Matter.IBodyDefinition> = {}
): Matter.Body {
  const obstacle = Matter.Bodies.circle(x, y, radius, {
    isStatic: true,
    label: "obstacle",
    render: { fillStyle: "#ef4444" },
    ...options,
  })

  Matter.World.add(world, obstacle)
  return obstacle
}


