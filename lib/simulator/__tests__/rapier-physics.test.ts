import { describe, it, expect } from "vitest"
import { createPhysicsWorld, addArenaBodies } from "../rapier-physics"

describe("createPhysicsWorld", () => {
  it("creates a world with zero gravity", async () => {
    const world = await createPhysicsWorld()
    expect(world.gravity.x).toBe(0)
    expect(world.gravity.y).toBe(0)
    world.free()
  })
})

describe("addArenaBodies", () => {
  it("adds static bodies for open-arena walls", async () => {
    const world = await createPhysicsWorld()
    addArenaBodies(world, "open-arena")
    // 4 walls added as fixed rigid bodies
    let bodyCount = 0
    world.forEachRigidBody(() => { bodyCount++ })
    expect(bodyCount).toBe(4)
    world.free()
  })

  it("adds obstacle bodies for obstacle-course", async () => {
    const world = await createPhysicsWorld()
    addArenaBodies(world, "obstacle-course")
    // 4 walls + 5 obstacles = 9
    let bodyCount = 0
    world.forEachRigidBody(() => { bodyCount++ })
    expect(bodyCount).toBe(9)
    world.free()
  })
})
