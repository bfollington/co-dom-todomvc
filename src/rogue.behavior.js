import * as DB from './db.js'
import * as UI from './ui.js'
import * as System from './system.js'

/** @type {DB.Term<number>} */
const playerX = DB.integer()
/** @type {DB.Term<number>} */
const playerY = DB.integer()
/** @type {DB.Term<string>} */
const direction = DB.string()
/** @type {DB.Term<DB.Entity>} */
const event = DB.variable()
/** @type {DB.Term<boolean>} */
const isInitialized = DB.boolean()

const wallX = DB.integer()
const wallY = DB.integer()

const GRID_SIZE = 5

export default System.be({
  // Initialize the game
  initGame: {
    select: { self: DB.self },
    where: [{ Not: { Case: [DB.self, 'isInitialized', isInitialized] } }],
    update: ({ self }) => [
      { Associate: [self, 'playerX', 2] },
      { Associate: [self, 'playerY', 2] },
      { Associate: [self, 'isInitialized', true] },
      { Associate: [self, 'wall/x', 1] },
      { Associate: [self, 'wall/y', 1] },
    ],
  },

  // Handle player movement
  movePlayer: {
    select: {
      self: DB.self,
      playerX,
      playerY,
      event,
      wall: [
        {
          x: wallX,
          y: wallY,
        },
      ],
    },
    where: [
      { Case: [DB.self, 'playerX', playerX] },
      { Case: [DB.self, 'playerY', playerY] },
      { Case: [DB.self, 'wall/x', wallX] },
      { Case: [DB.self, 'wall/y', wallY] },
      { Case: [DB.self, `/on/move`, event] },
    ],
    update: ({ self, playerX, playerY, event, wall }) => {
      const direction = event.value.target.dataset.direction
      let newX = playerX
      let newY = playerY
      console.log('direction', direction)

      switch (direction) {
        case 'up':
          newY = Math.max(0, playerY - 1)
          break
        case 'down':
          newY = Math.min(GRID_SIZE - 1, playerY + 1)
          break
        case 'left':
          newX = Math.max(0, playerX - 1)
          break
        case 'right':
          newX = Math.min(GRID_SIZE - 1, playerX + 1)
          break
      }

      // Check if the new position collides with a wall
      const isWallCollision = wall.some((w) => w.x === newX && w.y === newY)
      if (isWallCollision) {
        // If there's a wall collision, revert to the original position
        newX = playerX
        newY = playerY
      }

      return [
        { Disassociate: [self, 'playerX', playerX] },
        { Disassociate: [self, 'playerY', playerY] },
        { Associate: [self, 'playerX', newX] },
        { Associate: [self, 'playerY', newY] },
      ]
    },
  },

  // Render the game
  renderGame: {
    select: {
      self: DB.self,
      playerX,
      playerY,
      wall: [
        {
          x: wallX,
          y: wallY,
        },
      ],
    },
    where: [
      { Case: [DB.self, 'playerX', playerX] },
      { Case: [DB.self, 'playerY', playerY] },
      { Case: [DB.self, 'wall/x', wallX] },
      { Case: [DB.self, 'wall/y', wallY] },
    ],
    update: ({ self, playerX, playerY, wall }) => {
      const grid = []
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = []
        for (let x = 0; x < GRID_SIZE; x++) {
          if (x === playerX && y === playerY) {
            row.push('@')
          } else if (wall.some((w) => w.x === x && w.y === y)) {
            row.push('#')
          } else {
            row.push('.')
          }
        }
        grid.push(row)
      }

      const gridUI = UI.table(
        [],
        grid.map((row) =>
          UI.tr(
            [],
            row.map((cell) => UI.td([], [UI.code([], [UI.text(cell)])]))
          )
        )
      )

      const moveButton = (direction, label) =>
        UI.button(
          [
            UI.attribute('data-direction', direction),
            UI.on('click', self, `/on/move`),
          ],
          [UI.text(label)]
        )

      const controls = UI.div(
        [],
        [
          moveButton('up', 'Up'),
          moveButton('down', 'Down'),
          moveButton('left', 'Left'),
          moveButton('right', 'Right'),
        ]
      )

      return UI.swap([self, '/common/ui', UI.div([], [gridUI, controls])])
    },
  },
})
