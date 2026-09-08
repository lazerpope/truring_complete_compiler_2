// TuringScript falling-sand simulation
// Pixel 8 mode 39: 160 x 120, double buffered

const SCREEN_WIDTH = 120
const SCREEN_HEIGHT = 90
let FRAME_TICKS = 372

let EMPTY = 0
let SAND_RESTING = 1
let SAND_MOVING = 2
let SOLID_FLAG = 256

// RRRGGGBB colors. Moving sand is one red/green step brighter.
let BACKGROUND_COLOR = 0b00000000
let WALL_COLOR = 0b01001001
let SPOUT_COLOR = 0b10110110
let RESTING_SAND_COLOR = 0b11011000
let MOVING_SAND_COLOR = 0b11111100

// Controls how many grains are released per simulation tick. Keep this in 1..9.
let SAND_PER_TICK = 8
let SPOUT_WIDTH = 9
let SPOUT_HALF_WIDTH = 4
let SPOUT_STEP = 3

// Arrow-key codes used by the Symphony keyboard.
let KEY_DOWN = 209
let KEY_LEFT = 208
let KEY_RIGHT = 210

let screen = Screen8(29)
let cells = Array(SCREEN_WIDTH * SCREEN_HEIGHT)

// Packed solid bodies: high nibble is x / 10, low nibble is y / 8.
// For example, 0b00110100 places a 10 x 8 body at x=30, y=32.
// Add, remove, or move entries here. Keep the y nibble in 0..14.
let solid = [0b00110100, 0b01000100, 0b01010100, 0b10000110, 0b10010110, 0b11001000, 0b01011010, 0b10111100]

let randomSeed = time_0()
if (randomSeed == 0) {
	randomSeed = 0b1010010101011010
}

// Build an impermeable one-pixel wall around the whole screen.
let wallY = 0
while (wallY < SCREEN_HEIGHT) {
	let leftWallIndex = wallY * SCREEN_WIDTH
	let rightWallIndex = leftWallIndex + SCREEN_WIDTH - 1
	cells[leftWallIndex] = SOLID_FLAG | WALL_COLOR
	cells[rightWallIndex] = SOLID_FLAG | WALL_COLOR
	wallY++
}

let wallX = 0
while (wallX < SCREEN_WIDTH) {
	cells[wallX] = SOLID_FLAG | WALL_COLOR
	let bottomWallIndex = (SCREEN_HEIGHT - 1) * SCREEN_WIDTH + wallX
	cells[bottomWallIndex] = SOLID_FLAG | WALL_COLOR
	wallX++
}

// Expand every packed solid into the cell map and give it one random color.
let solidIndex = 0
while (solidIndex < solid.length) {
	let randomA = randomSeed ^ (randomSeed >> 13)
	let randomB = randomA ^ (randomA << 17)
	randomSeed = randomB ^ (randomB >> 5)

	let bodyColor = (randomSeed & 0b11111111) | 0b00100101
	if (bodyColor == RESTING_SAND_COLOR || bodyColor == MOVING_SAND_COLOR) {
		bodyColor = bodyColor ^ 0b00000011
	}
	let packedBody = solid[solidIndex] & 0b11111111
	let bodyX = ((packedBody >> 4) & 0b1111) * 10
	let bodyY = (packedBody & 0b1111) * 8

	let bodyRow = 0
	while (bodyRow < 8 && bodyY + bodyRow < SCREEN_HEIGHT) {
		let bodyColumn = 0
		while (bodyColumn < 10 && bodyX + bodyColumn < SCREEN_WIDTH) {
			let bodyCell = (bodyY + bodyRow) * SCREEN_WIDTH + bodyX + bodyColumn
			cells[bodyCell] = SOLID_FLAG | bodyColor
			bodyColumn++
		}
		bodyRow++
	}

	solidIndex++
}

let spoutX = SCREEN_WIDTH / 2
let dispensing = 0
let movingLeft = 0
let movingRight = 0
let scanDirection = 0

let low = time_0()
let high = time_1()
let previousClock = (high << 16) | (low >> 16)
let simulationRunning = 1

while (simulationRunning == 1) {
	low = time_0()
	high = time_1()
	let currentClock = (high << 16) | (low >> 16)
	let elapsed = currentClock - previousClock
	if (elapsed < FRAME_TICKS) {
		continue
	}
	previousClock = previousClock + FRAME_TICKS

	// Left and right move the spout. Hold down to dispense sand.
	let event = keyboard()
	while (event != 0) {
		let key = event & 0xff
		let isDown = (event & 0x100) != 0

		if (key == KEY_LEFT) {
			if (isDown) {
				movingLeft = 1
			} else {
				movingLeft = 0
			}
		}
		if (key == KEY_RIGHT) {
			if (isDown) {
				movingRight = 1
			} else {
				movingRight = 0
			}
		}
		if (key == KEY_DOWN) {
			if (isDown) {
				dispensing = 1
			} else {
				dispensing = 0
			}
		}

		event = keyboard()
	}

	if (movingLeft == 1 && movingRight == 0) {
		if (spoutX < SPOUT_HALF_WIDTH + SPOUT_STEP + 1) {
			spoutX = SPOUT_HALF_WIDTH + 1
		} else {
			spoutX = spoutX - SPOUT_STEP
		}
	}
	if (movingRight == 1 && movingLeft == 0) {
		if (spoutX + SPOUT_HALF_WIDTH + SPOUT_STEP >= SCREEN_WIDTH - 1) {
			spoutX = SCREEN_WIDTH - SPOUT_HALF_WIDTH - 2
		} else {
			spoutX = spoutX + SPOUT_STEP
		}
	}

	// Fill distinct cells below the nozzle, up to its nine-pixel width.
	if (dispensing == 1) {
		let spawnCount = Math.min(SAND_PER_TICK, SPOUT_WIDTH)
		let spawn = 0
		while (spawn < spawnCount) {
			let spawnX = spoutX + spawn - SPOUT_HALF_WIDTH
			let spawnCell = SCREEN_WIDTH + spawnX
			if (cells[spawnCell] == EMPTY) {
				cells[spawnCell] = SAND_MOVING
			}
			spawn++
		}
	}

	// Process bottom-to-top so a grain moves at most once per tick.
	// Horizontal scan direction alternates to avoid a persistent side bias.
	let remainingRows = SCREEN_HEIGHT
	while (remainingRows > 0) {
		remainingRows--
		let y = remainingRows
		let columnCounter = 0
		while (columnCounter < SCREEN_WIDTH) {
			let x = columnCounter
			if (scanDirection == 1) {
				x = SCREEN_WIDTH - 1 - columnCounter
			}

			let cellIndex = y * SCREEN_WIDTH + x
			let cellState = cells[cellIndex]

			if (cellState == SAND_RESTING || cellState == SAND_MOVING) {
				let destinationIndex = cellIndex
				let destinationX = x
				let moved = 0

				if (y < SCREEN_HEIGHT - 1) {
					let belowIndex = cellIndex + SCREEN_WIDTH
					if (cells[belowIndex] == EMPTY) {
						destinationIndex = belowIndex
						destinationX = x
						moved = 1
					} else {
						let fallRandomA = randomSeed ^ (randomSeed >> 13)
						let fallRandomB = fallRandomA ^ (fallRandomA << 17)
						randomSeed = fallRandomB ^ (fallRandomB >> 5)
						let preferLeft = randomSeed & 1

						if (preferLeft == 1) {
							if (x > 1 && cells[belowIndex - 1] == EMPTY) {
								destinationIndex = belowIndex - 1
								destinationX = x - 1
								moved = 1
							} else if (x < SCREEN_WIDTH - 2 && cells[belowIndex + 1] == EMPTY) {
								destinationIndex = belowIndex + 1
								destinationX = x + 1
								moved = 1
							}
						} else {
							if (x < SCREEN_WIDTH - 2 && cells[belowIndex + 1] == EMPTY) {
								destinationIndex = belowIndex + 1
								destinationX = x + 1
								moved = 1
							} else if (x > 1 && cells[belowIndex - 1] == EMPTY) {
								destinationIndex = belowIndex - 1
								destinationX = x - 1
								moved = 1
							}
						}
					}
				}

				if (moved == 1) {
					cells[cellIndex] = EMPTY
					cells[destinationIndex] = SAND_MOVING
					screen[destinationX][y + 1] = MOVING_SAND_COLOR
				} else {
					cells[cellIndex] = SAND_RESTING
					screen[x][y] = RESTING_SAND_COLOR
				}
			} else if (cellState >= SOLID_FLAG) {
				screen[x][y] = cellState & 0xff
			}

			columnCounter++
		}
	}

	// Draw the movable nozzle over the top wall.
	let nozzlePixel = 0
	while (nozzlePixel < SPOUT_WIDTH) {
		let nozzleX = spoutX + nozzlePixel - SPOUT_HALF_WIDTH
		screen[nozzleX][0] = SPOUT_COLOR
		nozzlePixel++
	}

	scanDirection = scanDirection ^ 1
	screen.present(BACKGROUND_COLOR)
}
