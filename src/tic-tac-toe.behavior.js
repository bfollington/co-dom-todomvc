import * as DB from './db.js'
import * as UI from './ui.js'
import * as System from './system.js'

/** @type {DB.Term<string>} */
const cellContent = DB.string()
/** @type {DB.Term<string>} */
const currentPlayer = DB.string()
/** @type {DB.Term<string>} */
const gameStatus = DB.string()
/** @type {DB.Term<DB.Entity>} */
const event = DB.variable()
/** @type {DB.Term<DB.Int32>} */
const x = DB.integer()
/** @type {DB.Term<DB.Int32>} */
const y = DB.integer()

/** @type {DB.Term<string>} */
const cell00 = DB.variable()
/** @type {DB.Term<string>} */
const cell01 = DB.variable()
/** @type {DB.Term<string>} */
const cell02 = DB.variable()
/** @type {DB.Term<string>} */
const cell10 = DB.variable()
/** @type {DB.Term<string>} */
const cell11 = DB.variable()
/** @type {DB.Term<string>} */
const cell12 = DB.variable()
/** @type {DB.Term<string>} */
const cell20 = DB.variable()
/** @type {DB.Term<string>} */
const cell21 = DB.variable()
/** @type {DB.Term<string>} */
const cell22 = DB.variable()

/** @type {DB.Term<boolean>} */
const isInitialized = DB.boolean()

export default System.be({
  // Initialize the game
  initGame: {
    select: { self: DB.self },
    where: [{ Not: { Case: [DB.self, 'isInitialized', isInitialized] } }],
    update: ({ self }) => [
      { Associate: [self, 'currentPlayer', 'X'] },
      { Associate: [self, 'gameStatus', 'ongoing'] },
      { Associate: [self, 'isInitialized', true] },
      { Associate: [self, '0/0', ''] },
      { Associate: [self, '0/1', ''] },
      { Associate: [self, '0/2', ''] },
      { Associate: [self, '1/0', ''] },
      { Associate: [self, '1/1', ''] },
      { Associate: [self, '1/2', ''] },
      { Associate: [self, '2/0', ''] },
      { Associate: [self, '2/1', ''] },
      { Associate: [self, '2/2', ''] },
    ],
  },

  // Handle player moves
  makeMove: {
    select: { self: DB.self, currentPlayer, event },
    where: [
      { Case: [DB.self, 'currentPlayer', currentPlayer] },
      { Case: [DB.self, 'gameStatus', 'ongoing'] },
      { Case: [DB.self, `/on/click`, event] },
    ],
    update: ({ self, currentPlayer, event }) => {
      const { x, y } = event.value.target.dataset
      return [
        { Associate: [self, `${x}/${y}`, currentPlayer] },
        { Disassociate: [self, 'currentPlayer', currentPlayer] },
        {
          Associate: [self, 'currentPlayer', currentPlayer === 'X' ? 'O' : 'X'],
        },
      ]
    },
  },

  // Render the game board
  renderBoard: {
    select: {
      self: DB.self,
      gameStatus,
      currentPlayer,
      cell00,
      cell01,
      cell02,
      cell10,
      cell11,
      cell12,
      cell20,
      cell21,
      cell22,
    },
    where: [
      { Case: [DB.self, 'gameStatus', gameStatus] },
      { Case: [DB.self, 'currentPlayer', currentPlayer] },
      { Case: [DB.self, '0/0', cell00] },
      { Case: [DB.self, '0/1', cell01] },
      { Case: [DB.self, '0/2', cell02] },
      { Case: [DB.self, '1/0', cell10] },
      { Case: [DB.self, '1/1', cell11] },
      { Case: [DB.self, '1/2', cell12] },
      { Case: [DB.self, '2/0', cell20] },
      { Case: [DB.self, '2/1', cell21] },
      { Case: [DB.self, '2/2', cell22] },
    ],
    update: ({
      self,
      gameStatus,
      currentPlayer,
      cell00,
      cell01,
      cell02,
      cell10,
      cell11,
      cell12,
      cell20,
      cell21,
      cell22,
    }) => {
      const cellContents = [
        [cell00, cell01, cell02],
        [cell10, cell11, cell12],
        [cell20, cell21, cell22],
      ]

      const cells = cellContents.map((row, i) =>
        UI.tr(
          [],
          row.map((content, j) =>
            UI.td(
              [],
              [
                UI.button(
                  [
                    UI.attribute('data-x', `${i}`),
                    UI.attribute('data-y', `${j}`),
                    UI.on('click', self, `/on/click`),
                  ],
                  [UI.text(content || '_')]
                ),
              ]
            )
          )
        )
      )

      const table = UI.table([], cells)

      const board = UI.div([], cells)
      const status = UI.div([], [UI.text(`Status: ${gameStatus}`)])
      const turn = UI.div([], [UI.text(`Current player: ${currentPlayer}`)])

      return UI.swap([self, '/common/ui', UI.div([], [board, status, turn])])
    },
  },
})
