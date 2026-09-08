// TuringScript fixed-point spinning, flying, textured 3D cube
// Pixel 8 mode, 80 x 60, approximately 12 frames per second

class Game {
    FRAME_TICKS = 1272
    CENTER_X = 40
    CENTER_Y = 30
    FOCAL_LENGTH = 80
    TRIG_SCALE = 256
    NEAR_DISTANCE = 70
    FAR_DISTANCE = 120
    OUTLINE_COLOR = 28
}
let game = Game()

let screen = Screen8(19)

// One complete turn in 32 fixed-point steps. Values are scaled by 256.
let sine = [0, 50, 98, 142, 181, 213, 237, 251, 256, 251, 237, 213, 181, 142, 98, 50, 0, -50, -98, -142, -181, -213, -237, -251, -256, -251, -237, -213, -181, -142, -98, -50]

// Eight cube vertices centered around the origin.
let vertexX = [-10, 10, 10, -10, -10, 10, 10, -10]
let vertexY = [-10, -10, 10, 10, -10, -10, 10, 10]
let vertexZ = [-10, -10, -10, -10, 10, 10, 10, 10]

// Six outward-facing quads. Each face has a bright and dark texture color.
let faceA = [0, 4, 0, 3, 0, 1]
let faceB = [1, 7, 4, 2, 3, 5]
let faceC = [2, 6, 5, 6, 7, 6]
let faceD = [3, 5, 1, 7, 4, 2]
let faceBright = [224, 240, 252, 3, 163, 28]
let faceDark = [128, 144, 148, 2, 98, 16]
let faceEdgeA = [0, 7, 8, 2, 3, 9]
let faceEdgeB = [1, 6, 4, 10, 11, 5]
let faceEdgeC = [2, 5, 9, 6, 7, 10]
let faceEdgeD = [3, 4, 0, 11, 8, 1]

// Twelve edges used for the final outline.
let edgeA = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3]
let edgeB = [1, 2, 3, 0, 5, 6, 7, 4, 4, 5, 6, 7]
let visibleEdge = Array(12)

let projectedX = Array(8)
let projectedY = Array(8)
let oldProjectedX = Array(8)
let oldProjectedY = Array(8)

let horizontalAngle = 0
let verticalAngle = 0
let verticalAngleDelay = 0
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

    // Keep the previous projection so the old filled cube can be erased.
    let vertexIndex = 0
    while (vertexIndex < 8) {
        oldProjectedX[vertexIndex] = projectedX[vertexIndex]
        oldProjectedY[vertexIndex] = projectedY[vertexIndex]
        vertexIndex++
    }

    // Horizontal rotation advances every frame.
    horizontalAngle++
    horizontalAngle = horizontalAngle % 32

    // Vertical rotation advances every second frame, so it is two times slower.
    verticalAngleDelay++
    if (verticalAngleDelay >= 2) {
        verticalAngleDelay = 0
        verticalAngle++
        verticalAngle = verticalAngle % 32
    }

    // Fly toward and away from the camera.
    distance = distance + distanceDirection
    if (distance >= game.FAR_DISTANCE) {
        distanceDirection = -1
    }
    if (distance <= game.NEAR_DISTANCE) {
        distanceDirection = 1
    }

    let horizontalSine = sine[horizontalAngle]
    let horizontalCosineIndex = (horizontalAngle + 8) % 32
    let horizontalCosine = sine[horizontalCosineIndex]
    let verticalSine = sine[verticalAngle]
    let verticalCosineIndex = (verticalAngle + 8) % 32
    let verticalCosine = sine[verticalCosineIndex]

    // Rotate every vertex around Y and then X, then apply perspective.
    vertexIndex = 0
    while (vertexIndex < 8) {
        let sourceX = vertexX[vertexIndex]
        let sourceY = vertexY[vertexIndex]
        let sourceZ = vertexZ[vertexIndex]

        let yRotationXNumerator = sourceX * horizontalCosine - sourceZ * horizontalSine
        let yRotationX = Math.abs(yRotationXNumerator) / game.TRIG_SCALE
        if (yRotationXNumerator s< 0) {
            yRotationX = -yRotationX
        }

        let yRotationZNumerator = sourceX * horizontalSine + sourceZ * horizontalCosine
        let yRotationZ = Math.abs(yRotationZNumerator) / game.TRIG_SCALE
        if (yRotationZNumerator s< 0) {
            yRotationZ = -yRotationZ
        }

        let xRotationYNumerator = sourceY * verticalCosine - yRotationZ * verticalSine
        let rotatedY = Math.abs(xRotationYNumerator) / game.TRIG_SCALE
        if (xRotationYNumerator s< 0) {
            rotatedY = -rotatedY
        }

        let xRotationZNumerator = sourceY * verticalSine + yRotationZ * verticalCosine
        let rotatedZ = Math.abs(xRotationZNumerator) / game.TRIG_SCALE
        if (xRotationZNumerator s< 0) {
            rotatedZ = -rotatedZ
        }

        let depth = distance + rotatedZ

        let projectedXNumerator = yRotationX * game.FOCAL_LENGTH
        let projectedXOffset = Math.abs(projectedXNumerator) / depth
        if (projectedXNumerator s< 0) {
            projectedX[vertexIndex] = game.CENTER_X - projectedXOffset
        } else {
            projectedX[vertexIndex] = game.CENTER_X + projectedXOffset
        }

        let projectedYNumerator = rotatedY * game.FOCAL_LENGTH
        let projectedYOffset = Math.abs(projectedYNumerator) / depth
        if (projectedYNumerator s< 0) {
            projectedY[vertexIndex] = game.CENTER_Y + projectedYOffset
        } else {
            projectedY[vertexIndex] = game.CENTER_Y - projectedYOffset
        }

        vertexIndex++
    }

    // Explicitly erase every old DDA outline. Face filling alone cannot erase
    // every rounded edge pixel because a line can land just outside its quad.
    let eraseEdgeIndex = 0
    while (eraseEdgeIndex < 12) {
        let eraseFirstVertex = edgeA[eraseEdgeIndex]
        let eraseSecondVertex = edgeB[eraseEdgeIndex]
        let eraseX1 = oldProjectedX[eraseFirstVertex]
        let eraseY1 = oldProjectedY[eraseFirstVertex]
        let eraseX2 = oldProjectedX[eraseSecondVertex]
        let eraseY2 = oldProjectedY[eraseSecondVertex]
        let eraseDeltaX = eraseX2 - eraseX1
        let eraseDeltaY = eraseY2 - eraseY1
        let eraseAbsoluteX = Math.abs(eraseDeltaX)
        let eraseAbsoluteY = Math.abs(eraseDeltaY)
        let eraseSteps = Math.max(eraseAbsoluteX, eraseAbsoluteY)
        let erasePoint = 0

        while (erasePoint <= eraseSteps) {
            let eraseXDistance = eraseAbsoluteX * erasePoint / eraseSteps
            let eraseYDistance = eraseAbsoluteY * erasePoint / eraseSteps
            let eraseX = eraseX1 + eraseXDistance
            let eraseY = eraseY1 + eraseYDistance
            if (eraseDeltaX s< 0) {
                eraseX = eraseX1 - eraseXDistance
            }
            if (eraseDeltaY s< 0) {
                eraseY = eraseY1 - eraseYDistance
            }
            screen[eraseX][eraseY] = 0
            erasePoint++
        }

        eraseEdgeIndex++
    }

    // Reset the outline visibility collected from the new front-facing sides.
    let resetEdge = 0
    while (resetEdge < 12) {
        visibleEdge[resetEdge] = 0
        resetEdge++
    }

    // Pass zero erases old visible faces. Pass one paints new visible faces.
    let drawPass = 0
    while (drawPass < 2) {
        let faceIndex = 0
        while (faceIndex < 6) {
            let vertexA = faceA[faceIndex]
            let vertexB = faceB[faceIndex]
            let vertexC = faceC[faceIndex]
            let vertexD = faceD[faceIndex]
            let xA = 0
            let yA = 0
            let xB = 0
            let yB = 0
            let xC = 0
            let yC = 0
            let xD = 0
            let yD = 0

            if (drawPass == 0) {
                xA = oldProjectedX[vertexA]
                yA = oldProjectedY[vertexA]
                xB = oldProjectedX[vertexB]
                yB = oldProjectedY[vertexB]
                xC = oldProjectedX[vertexC]
                yC = oldProjectedY[vertexC]
                xD = oldProjectedX[vertexD]
                yD = oldProjectedY[vertexD]
            } else {
                xA = projectedX[vertexA]
                yA = projectedY[vertexA]
                xB = projectedX[vertexB]
                yB = projectedY[vertexB]
                xC = projectedX[vertexC]
                yC = projectedY[vertexC]
                xD = projectedX[vertexD]
                yD = projectedY[vertexD]
            }

            // Negative winding means that this face points toward the camera.
            let winding = (xB - xA) * (yC - yA) - (yB - yA) * (xC - xA)
            if (winding s<= 0) {
                if (drawPass == 1) {
                    visibleEdge[faceEdgeA[faceIndex]] = 1
                    visibleEdge[faceEdgeB[faceIndex]] = 1
                    visibleEdge[faceEdgeC[faceIndex]] = 1
                    visibleEdge[faceEdgeD[faceIndex]] = 1
                }
                let minimumX = Math.min(xA, xB)
                minimumX = Math.min(minimumX, xC)
                minimumX = Math.min(minimumX, xD)
                let maximumX = Math.max(xA, xB)
                maximumX = Math.max(maximumX, xC)
                maximumX = Math.max(maximumX, xD)
                let minimumY = Math.min(yA, yB)
                minimumY = Math.min(minimumY, yC)
                minimumY = Math.min(minimumY, yD)
                let maximumY = Math.max(yA, yB)
                maximumY = Math.max(maximumY, yC)
                maximumY = Math.max(maximumY, yD)

                let pixelY = minimumY
                while (pixelY <= maximumY) {
                    let pixelX = minimumX
                    while (pixelX <= maximumX) {
                        let crossAB = (xB - xA) * (pixelY - yA) - (yB - yA) * (pixelX - xA)
                        let crossBC = (xC - xB) * (pixelY - yB) - (yC - yB) * (pixelX - xB)
                        let crossCD = (xD - xC) * (pixelY - yC) - (yD - yC) * (pixelX - xC)
                        let crossDA = (xA - xD) * (pixelY - yD) - (yA - yD) * (pixelX - xD)

                        if (crossAB s<= 0 && crossBC s<= 0 && crossCD s<= 0 && crossDA s<= 0) {
                            let pixelColor = 0
                            if (drawPass == 1) {
                                let textureX = (pixelX - minimumX) / 3
                                let textureY = (pixelY - minimumY) / 3
                                let textureCell = (textureX + textureY) & 1
                                pixelColor = faceBright[faceIndex]
                                if (textureCell == 1) {
                                    pixelColor = faceDark[faceIndex]
                                }
                            }
                            screen[pixelX][pixelY] = pixelColor
                        }

                        pixelX++
                    }
                    pixelY++
                }
            }

            faceIndex++
        }
        drawPass++
    }

    // Draw a bright outline over the textured faces.
    let edgeIndex = 0
    while (edgeIndex < 12) {
        if (visibleEdge[edgeIndex] == 1) {
            let firstVertex = edgeA[edgeIndex]
            let secondVertex = edgeB[edgeIndex]
            let x1 = projectedX[firstVertex]
            let y1 = projectedY[firstVertex]
            let x2 = projectedX[secondVertex]
            let y2 = projectedY[secondVertex]
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
                if (deltaX s< 0) {
                    drawX = x1 - xDistance
                }
                if (deltaY s< 0) {
                    drawY = y1 - yDistance
                }
                screen[drawX][drawY] = game.OUTLINE_COLOR
                point++
            }
        }

        edgeIndex++
    }
    screen.present(0)
}
