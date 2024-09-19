import * as DB from './db.js'
import * as UI from './ui.js'
import * as System from './system.js'

/** @type {DB.Term<string>} */
const title = DB.string()
/** @type {DB.Term<boolean>} */
const complete = DB.boolean()
/** @type {DB.Term<DB.Entity>} */
const event = DB.variable()
/** @type {DB.Term<DB.Int32>} */
const count = DB.integer()

export default System.be({
  /**
   * Derives default title for the todo item.
   */
  defaultTitle: {
    select: { self: DB.self, title },
    /**
     * @type {DB.Clause[]}
     */
    where: [
      { Not: { Case: [DB.self, 'title', title] } },
      { Is: [title, 'Clicks'] },
    ],

    update: ({ self, title }) => [{ Associate: [self, 'title', title] }],
  },
  /**
   * Derives default completion status for the todo item.
   */
  defaultComplete: {
    where: [
      { Not: { Case: [DB.self, 'complete', complete] } },
      { Is: [complete, false] },
    ],
    select: { self: DB.self, complete },
    update: ({ self, complete }) => [
      { Associate: [self, 'complete', complete] },
    ],
  },
  view: {
    select: { self: DB.self, title, count },
    where: [
      { Case: [DB.self, 'title', title] },
      { Case: [DB.self, 'click/count', count] },
    ],
    update: ({ self, title, count }) => {
      const ui = UI.button(
        [
          UI.attribute('data-id', `${self}`),
          // listener
          UI.on('click', self, '/on/click'),
        ],
        [UI.text(title), UI.text(` (${count})`)]
      )

      return UI.swap([self, '/common/ui', ui])
    },
  },
  defaultCount: {
    select: { self: DB.self, count },
    where: [
      { Not: { Case: [DB.self, 'click/count', count] } },
      { Is: [count, 0] },
    ],

    update: ({ self, count }) => [{ Associate: [self, 'click/count', count] }],
  },
  clickCount: {
    select: { self: DB.self, count },
    where: [
      { Case: [DB.self, 'click/count', count] },
      { Case: [DB.self, '/on/click', event] },
    ],
    update: ({ self, count }) => [
      { Disassociate: [self, 'click/count', count] },
      { Associate: [self, 'click/count', ++count] },
    ],
  },
})
