class Game {
  W = 80 //px wide
  H = 60 //px high
  screen_size = 19 // converts to 80 by 60 by the game
  FRAME_TICKS = 1272 //delay in ticks for 12 FPS
}
let game = Game()
class Score {
  color = 0b11111010
  offset_x = 7
  offset_y = 3
  offset_x_decimal = 3
  zero = [1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1]
  one = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]
  two = [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1]
  three = [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1]
  four = [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1]
  five = [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1]
  six = [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1]
  seven = [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]
  eight = [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1]
  nine = [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1]
}
let score = Score()

let screen = Screen8(19)

class Snake {
  x = game.W / 2
  y = game.H / 2
  color = 0b00011100
  direction = 0 //0 nothing and  1234 is UDLR
  score = 0
}
// KEYS  UDLR 193 209  208 210
let snake = Snake()
class KB {
  UP = 193 //193
  DOWN = 209 //209
  LEFT = 208 //208
  RIGHT = 210 //210
}
let kb = KB()
class Food {
  x = 0
  y = 0
  color = 0b00011111
}

//RANDOM FOOD POSITIONS
let food = Food()
let random_seed = time_0()
let t1 = random_seed ^ (random_seed >> 13)
let t2 = t1 ^ (t1 << 17)
random_seed = t2 ^ (t2 >> 5)
food.x = random_seed % game.W

t1 = random_seed ^ (random_seed >> 13)
t2 = t1 ^ (t1 << 17)
random_seed = t2 ^ (t2 >> 5)
food.y = random_seed % game.H

let low = time_0()
let high = time_1()
let previousClock = (high << 16) | (low >> 16) //actual clock of middle 32 bytes of timestamp

while (true) {
  //clock at 12FPS
  low = time_0()
  high = time_1()

  let currentClock = (high << 16) | (low >> 16)
  let elapsed = currentClock - previousClock

  if (elapsed < game.FRAME_TICKS) {
    continue
  }
  previousClock = previousClock + game.FRAME_TICKS

  //KEYBOARD
  let event = keyboard()

  while (event != 0) {
    let key = event & 0xff
    let isDown = (event & 0x100) != 0

    if (isDown) {
      if (key == kb.UP) {
        snake.direction = 1
      } else if (key == kb.DOWN) {
        snake.direction = 2
      } else if (key == kb.LEFT) {
        snake.direction = 3
      } else if (key == kb.RIGHT) {
        snake.direction = 4
      }
    }
    event = keyboard()
  }

  //MOVE SNAKE
  screen[snake.x][snake.y] = 0
  if (snake.direction == 1) {
    snake.y--
  }
  if (snake.direction == 2) {
    snake.y++
  }
  if (snake.direction == 3) {
    snake.x--
  }
  if (snake.direction == 4) {
    snake.x++
  }
  screen[snake.x][snake.y] = snake.color
  //MOVE SNAKE END
  //DRAW FOOD
  screen[food.x][food.y] = food.color
  if (snake.x == food.x && snake.y == food.y) {
    game.FRAME_TICKS -= game.FRAME_TICKS / 10
    screen[food.x][food.y] = 0
    snake.score++
    //RANDOM FOOD POSITIONS
    t1 = random_seed ^ (random_seed >> 13)
    t2 = t1 ^ (t1 << 17)
    random_seed = t2 ^ (t2 >> 5)
    food.x = random_seed % game.W

    t1 = random_seed ^ (random_seed >> 13)
    t2 = t1 ^ (t1 << 17)
    random_seed = t2 ^ (t2 >> 5)
    food.y = random_seed % game.H

    screen[food.x][food.y] = food.color
  }
  //DRAW FOOD     END
  //DRAW SCORE
  let row = 0
  let column = 0
  let score_num = snake.score % 10
  let score_dec = snake.score / 10
  for (row = 0; row < 5; row++) {
    for (column = 0; column < 3; column++) {
      let index = row * 3 + column
      let pixel = 0
      if (score_num == 0) {
        pixel = score.zero[index]
      } else if (score_num == 1) {
        pixel = score.one[index]
      } else if (score_num == 2) {
        pixel = score.two[index]
      } else if (score_num == 3) {
        pixel = score.three[index]
      } else if (score_num == 4) {
        pixel = score.four[index]
      } else if (score_num == 5) {
        pixel = score.five[index]
      } else if (score_num == 6) {
        pixel = score.six[index]
      } else if (score_num == 7) {
        pixel = score.seven[index]
      } else if (score_num == 8) {
        pixel = score.eight[index]
      } else if (score_num == 9) {
        pixel = score.nine[index]
      }
      if (pixel == 1) {
        screen[column + score.offset_x][row + score.offset_y] = score.color
      } else {
        screen[column + score.offset_x][row + score.offset_y] = 0
      }
    }
  }
  for (row = 0; row < 5; row++) {
    for (column = 0; column < 3; column++) {
      index = row * 3 + column
      pixel = 0
      if (score_dec == 0) {
        pixel = score.zero[index]
      } else if (score_dec == 1) {
        pixel = score.one[index]
      } else if (score_dec == 2) {
        pixel = score.two[index]
      } else if (score_dec == 3) {
        pixel = score.three[index]
      } else if (score_dec == 4) {
        pixel = score.four[index]
      } else if (score_dec == 5) {
        pixel = score.five[index]
      } else if (score_dec == 6) {
        pixel = score.six[index]
      } else if (score_dec == 7) {
        pixel = score.seven[index]
      } else if (score_dec == 8) {
        pixel = score.eight[index]
      } else if (score_dec == 9) {
        pixel = score.nine[index]
      }
      if (pixel == 1) {
        screen[column + score.offset_x_decimal][row + score.offset_y] = score.color
      } else {
        screen[column + score.offset_x_decimal][row + score.offset_y] = 0
      }
    }
  }
  //DRAW SCORE END
  screen.present(0)
}
