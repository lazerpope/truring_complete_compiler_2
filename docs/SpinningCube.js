// TuringScript fixed-point spinning and flying 3D wireframe cube
// Pixel 8 mode, 80 x 60, approximately 12 frames per second
class Game {
    W = 80
    H = 60
    SCREEN_SIZE = 19
    FRAME_TICKS = 1272
    CENTER_X = 40
    CENTER_Y = 30
    FOCAL_LENGTH = 80
    TRIG_SCALE = 256
    NEAR_DISTANCE = 55
    FAR_DISTANCE = 100
}
let game = Game()
let screen = Screen8(19)
// One complete turn in 32 fixed-point steps. Values are scaled by 256.
let sine = [0, 50, 98, 142, 181, 213, 237, 251, 256, 251, 237, 213, 181, 142, 98, 50, 0, -50, -98, -142, -181, -213, -237, -251, -256, -251, -237, -213, -181, -142, -98, -50]
// Eight cube vertices centered around the origin.
let vertexX = [-12, 12, 12, -12, -12, 12, 12, -12]
let vertexY = [-12, -12, 12, 12, -12, -12, 12, 12]
let vertexZ = [-12, -12, -12, -12, 12, 12, 12, 12]
// The twelve cube edges reference pairs of vertex indexes.
let edgeA = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]
let edgeB = [1, 2, 3, 0, 5, 6, 7, 4, 4, 5, 6, 7]
let edgeColor = [224, 224, 224, 224, 3, 3, 3, 3, 28, 28, 28, 28]
let projectedX = Array(8)
let projectedY = Array(8)
let oldProjectedX = Array(8)
let oldProjectedY = Array(8)
let angle = 0
let distance = game.NEAR_DISTANCE
let distanceDirection = 1
let low = time_0()
let high = time_1()
let previousClock = (high << 16) | (low >> 16)
while (1) {
    // Wait for the next 12 FPS frame.
    low = time_0()
    high = time_1()
    let currentClock = (high << 16) | (low >> 16)
    let elapsed = currentClock - previousClock
    if (elapsed < game.FRAME_TICKS) {
        continue
    }
    previousClock = previousClock + game.FRAME_TICKS
    // Preserve the previous projection so its wireframe can be erased.
    let vertexIndex = 0
    while (vertexIndex < 8) {
        oldProjectedX[vertexIndex] = projectedX[vertexIndex]
        oldProjectedY[vertexIndex] = projectedY[vertexIndex]
        vertexIndex++
    }
    // Rotate continuously and fly between the near and far distances.
    angle++
    angle = angle % 32
    distance = distance + distanceDirection
    if (distance >= game.FAR_DISTANCE) {
        distanceDirection = -1
    }
    if (distance <= game.NEAR_DISTANCE) {
        distanceDirection = 1
    }
    let sineValue = sine[angle]
    let cosineIndex = (angle + 8) % 32
    let cosineValue = sine[cosineIndex]
    // Rotate every vertex around Y, then project it with integer perspective.
    vertexIndex = 0
    while (vertexIndex < 8) {
        let sourceX = vertexX[vertexIndex]
        let sourceY = vertexY[vertexIndex]
        let sourceZ = vertexZ[vertexIndex]
        let rotatedXNumerator = sourceX * cosineValue - sourceZ * sineValue
        let rotatedX = Math.abs(rotatedXNumerator) / game.TRIG_SCALE
        if (rotatedXNumerator s < 0) {
            rotatedX = -rotatedX
        }
        let rotatedZNumerator = sourceX * sineValue + sourceZ * cosineValue
        let rotatedZ = Math.abs(rotatedZNumerator) / game.TRIG_SCALE
        if (rotatedZNumerator s < 0) {
            rotatedZ = -rotatedZ
        }
        let depth = distance + rotatedZ
        let projectedXNumerator = rotatedX * game.FOCAL_LENGTH
        let projectedXOffset = Math.abs(projectedXNumerator) / depth
        if (projectedXNumerator s < 0) {
            projectedX[vertexIndex] = game.CENTER_X - projectedXOffset
        } else {
            projectedX[vertexIndex] = game.CENTER_X + projectedXOffset
        }
        let projectedYNumerator = sourceY * game.FOCAL_LENGTH
        let projectedYOffset = Math.abs(projectedYNumerator) / depth
        if (projectedYNumerator s < 0) {
            projectedY[vertexIndex] = game.CENTER_Y + projectedYOffset
        } else {
            projectedY[vertexIndex] = game.CENTER_Y - projectedYOffset
        }
        vertexIndex++
    }
    // Pass zero erases the old wireframe. Pass one draws the new wireframe.
    let drawPass = 0
    while (drawPass < 2) {
        let edgeIndex = 0
        while (edgeIndex < 12) {
            let firstVertex = edgeA[edgeIndex]
            let secondVertex = edgeB[edgeIndex]
            let x1 = 0
            let y1 = 0
            let x2 = 0
            let y2 = 0
            let color = 0
            if (drawPass == 0) {
                x1 = oldProjectedX[firstVertex]
                y1 = oldProjectedY[firstVertex]
                x2 = oldProjectedX[secondVertex]
                y2 = oldProjectedY[secondVertex]
            } else {
                x1 = projectedX[firstVertex]
                y1 = projectedY[firstVertex]
                x2 = projectedX[secondVertex]
                y2 = projectedY[secondVertex]
                color = edgeColor[edgeIndex]
            }
            // Integer DDA line rasterization.
            let deltaX = x2 - x1
            let deltaY = y2 - y1
            let absoluteX = Math.abs(deltaX)
            let absoluteY = Math.abs(deltaY)
            let steps = Math.max(absoluteX, absoluteY)
            let point = 0
            while (point <= steps) {
                let xDistance = absoluteX * point / steps
                let yDistance = absoluteY * point / steps
                let drawX = x1 + xDistance
                let drawY = y1 + yDistance
                if (deltaX s < 0) {
                    drawX = x1 - xDistance
                }
                if (deltaY s < 0) {
                    drawY = y1 - yDistance
                }
                screen[drawX][drawY] = color
                point++
            }
            edgeIndex++
        }
        drawPass++
    }
}