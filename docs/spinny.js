console.log(game)

const W = 800
const H = 600

const GREEN = "#50ff50"
const FPS = 60
const CUBE_CENTER_Z = 1.5
const ctx = game.getContext("2d")

setup()

const vs = [
  { x: 0.5, y: 0.5, z: 1 },
  { x: -0.5, y: 0.5, z: 1 },
  { x: -0.5, y: -0.5, z: 1 },
  { x: 0.5, y: -0.5, z: 1 },

  { x: 0.5, y: 0.5, z: 2 },
  { x: -0.5, y: 0.5, z: 2 },
  { x: -0.5, y: -0.5, z: 2 },
  { x: 0.5, y: -0.5, z: 2 },
]

const faces = [
  { vertices: [0, 1, 2, 3], color: "#ff4d4d" },
  { vertices: [4, 7, 6, 5], color: "#ff9f43" },
  { vertices: [0, 4, 5, 1], color: "#feca57" },
  { vertices: [3, 2, 6, 7], color: "#54a0ff" },
  { vertices: [0, 3, 7, 4], color: "#5f27cd" },
  { vertices: [1, 5, 6, 2], color: "#10ac84" },
]

let angle = 0
let dz = 0
let dzDir = 1

function loop(params) {
  const dt = 1 / FPS
  dz += 1 * dt * dzDir
  if (dz > 5) {
    dzDir = -1
  }
  if (dz < 0.3) {
    dzDir = 1
  }

  angle += 0.2 * Math.PI * dt
  clear()

  const transformed = vs.map((v) => translateZ(rotate(v, angle), dz))
  const projected = transformed.map((v) => screen(project(v)))
  const sortedFaces = [...faces].sort(
    (a, b) =>
      averageDepth(b.vertices, transformed) -
      averageDepth(a.vertices, transformed),
  )

  for (const face of sortedFaces) {
    polygon(
      face.vertices.map((index) => projected[index]),
      face.color,
    )
  }

  setTimeout(loop, 1000 / FPS)
}

setTimeout(loop, 1000 / FPS)

function setup() {
  game.width = W
  game.height = H
  clear()
}

function clear() {
  ctx.fillStyle = "#5f5f5f"
  ctx.fillRect(0, 0, W, H)
}

function point(p) {
  let s = 30
  ctx.fillStyle = GREEN
  ctx.fillRect(p.x - s / 2, p.y - s / 2, s / p.z, s / p.z)
}

function screen(p) {
  return {
    x: ((p.x + 1) / 2) * game.height,
    y: ((p.y + 1) / 2) * game.height,
    z: p.z,
  }
}

function project(p) {
  return {
    x: p.x / p.z,
    y: p.y / p.z,
    z: p.z,
  }
}

function translateZ(p, d) {
  return {
    x: p.x,
    y: p.y,
    z: p.z + d,
  }
}

function rotate(p, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const z = p.z - CUBE_CENTER_Z

  return {
    x: p.x * c - z * s,
    y: p.y,
    z: p.x * s + z * c + CUBE_CENTER_Z,
  }
}

function averageDepth(indices, vertices) {
  return (
    indices.reduce((sum, index) => sum + vertices[index].z, 0) /
    indices.length
  )
}

function polygon(points, color) {
  ctx.fillStyle = color
  ctx.strokeStyle = GREEN
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }

  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}
