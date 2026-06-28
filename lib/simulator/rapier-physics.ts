import RAPIER from "@dimforge/rapier2d-compat"

let rapierReady = false

export async function createPhysicsWorld(): Promise<RAPIER.World> {
  if (!rapierReady) {
    await RAPIER.init()
    rapierReady = true
  }
  const world = new RAPIER.World({ x: 0, y: 0 })
  world.timestep = 1 / 60
  return world
}

function addStaticBox(world: RAPIER.World, cx: number, cy: number, hw: number, hh: number): void {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy))
  world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh), body)
}

function addStaticCircle(world: RAPIER.World, cx: number, cy: number, r: number): void {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy))
  world.createCollider(RAPIER.ColliderDesc.ball(r), body)
}

// Wall thickness in pixels
const WALL = 10

export function addArenaBodies(world: RAPIER.World, arenaId: string): void {
  const W = 800
  const H = 600

  // 4 arena boundary walls (half-extents)
  addStaticBox(world, W / 2, -WALL / 2, W / 2, WALL / 2)       // top
  addStaticBox(world, W / 2, H + WALL / 2, W / 2, WALL / 2)    // bottom
  addStaticBox(world, -WALL / 2, H / 2, WALL / 2, H / 2)       // left
  addStaticBox(world, W + WALL / 2, H / 2, WALL / 2, H / 2)    // right

  switch (arenaId) {
    case "obstacle-course":
      // Mirrors arena.ts createObstacle(world, cx, cy, w, h) — divide w/h by 2 for half-extents
      addStaticBox(world, 250, 200, 40, 40)
      addStaticBox(world, 400, 400, 50, 30)
      addStaticCircle(world, 550, 250, 40)
      addStaticBox(world, 300, 500, 60, 20)
      addStaticCircle(world, 600, 450, 35)
      break

    case "maze":
      // Horizontal walls
      addStaticBox(world, 200, 120, 140, 10)
      addStaticBox(world, 500, 120, 100, 10)
      addStaticBox(world, 150, 240,  90, 10)
      addStaticBox(world, 450, 240, 150, 10)
      addStaticBox(world, 250, 360, 140, 10)
      addStaticBox(world, 650, 360,  50, 10)
      addStaticBox(world, 100, 480,  40, 10)
      addStaticBox(world, 350, 480, 150, 10)
      // Vertical walls
      addStaticBox(world, 340,  60, 10,  50)
      addStaticBox(world, 600, 180, 10,  50)
      addStaticBox(world, 240, 180, 10,  50)
      addStaticBox(world, 110, 300, 10,  50)
      addStaticBox(world, 390, 300, 10,  50)
      addStaticBox(world, 500, 420, 10,  50)
      addStaticBox(world, 200, 420, 10,  50)
      addStaticBox(world, 600, 540, 10,  50)
      break

    // open-arena and line-follow: walls only, no obstacles
  }
}
