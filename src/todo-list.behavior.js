// Datalog Receipts

// Rough sketch of what Todo MVC could look like. It uses query notation that
// is almost 1:1 translation from datomic's EDN to JSON.

// ℹ️ For simplicity we denote logic variables using a strings with a `?` prefix.
// In practice however, it would would probably need to be something less
// ambiguous perhaps `{"?": "name"}`, either way there is a lot of sugar that
// can be layered on top of this through DSL provided by the library.

import * as UI from './ui.js'
import * as DB from 'datalogia'
import * as Todo from './todo.behavior.js'
import * as HTTP from './http.js'
import * as URL from './url.js'
import * as Behavior from './behavior.js'
import * as Autocomplete from './autocomplete.js'

// Recipe is declared as module exporting static `be` object, which defines
// set of named behaviors for some dataset represented as a set of facts in an
// `[entity, attribute, value]` format.
//
// Each behavior consists of:
//
// 1. `query` that (statically) describes subset of relevant facts associated
//     with an entity behavior is operating on mapped to JSON structure.
// 2. `update` (pure) function that is triggered when query result changes, in
//     order to derives new set of facts.
//
// This forms a reactive system where some events trigger updates which in turn
// can trigger more updates until system reaches a stable state and it awaits
// occurrence of the next user event.
//
// ℹ️ Please note that behavior names are arbitrary and have no meaning beyond
// of just letting people talk about them.

/**
 * Defines a behavior for a todo list.
 */
export default {
  /**
   * This defines behavior of the main view of the todo list.
   */
  view: {
    /**
     * @typedef {object} Model
     * @property {DB.Entity} self
     * @property {DB.Entity[]} items
     * @property {string} input
     * @property {DB.Entity} ui
     */
    select: {
      /**
       * Entity exhibiting a behavior is denoted via special "?" variable. It
       * may seem that this restricts behavior to operate on a single entity,
       * however that is not a case because multiple entities can be simply
       * passed as a data structure like `{left, right}` allowing query to
       * select them as `["?", "left", "?left"]` and `["?", "right", "right"]`
       * respectively.
       */
      self: '?',
      /**
       * We want to collects all the items related to self.
       */
      items: ['?item'],
      // We want to capture new todo input in the input field
      input: '?input',

      // View into which we will render the todo list
      ui: '?ui',
    },
    // selection criteria defined in terms of relations
    where: [
      /**
       * Relations can be queried both ways to demonstrate it we model
       * our data as follows
       *
       * ```json
       * { id: 1, title: "Buy milk", "todo/list": [0] },
       * { id: 2, title: "Buy eggs", "todo/list": [0, 3] },
       * { id: 0, "todo/list/name": "Groceries", "todo/draft": "" }
       * { id: 3, "todo/list/name": "Today", "todo/draft": "" }
       * ```
       *
       * From which one can derive following facts:
       *
       * ```edn
       * [1, "title", "Buy milk"],
       * [1, "todo/list", 0],
       * [2, "title", "Buy eggs"],
       * [2, "todo/list", 0],
       * [2, "todo/list", 3],
       * [0, "todo/list/name", "Groceries"],
       * [0, "todo/draft", ""],
       * [3, "todo/list/name", "Today"],
       * [3, "todo/draft", ""],
       * ```
       *
       * In our case `self` is bound to `0` and we want to collect `1` & `2`
       * into `items`.
       */
      ['?item', 'todo/list', '?'],
      /**
       * We also capture input in `todo/draft` relation that describes text
       * typed from which new todo item will be created.
       */
      ['?', 'todo/draft', '?input'],

      /**
       * We want to derive the view for this state and associate it with `ui`
       * and we want to only compute it when `self` has associated `ui` to
       * render it into.
       */
      ['?', '/common/ui', '?ui'],
    ],

    /**
     * ```json
     * {
     *   self: 0,
     *   items: [1, 2],
     *   input: "",
     *   ui: 3
     * }
     * ```
     */

    /**
     * When data is changed we want to derived a view and associate it with
     * it with a `ui`.
     */
    update: {
      type: 'text/javascript',
      url: URL.from(
        /**
         * @param {Model} model
         */
        ({ self, items, input, ui }) => [
          [
            self,
            '/common/ui',
            UI.div(
              [UI.attribute('class', 'todomvc-wrapper')],
              [
                UI.section(
                  [UI.attribute('class', 'todoapp')],
                  [
                    UI.input([
                      UI.attribute('class', 'new-todo'),
                      UI.attribute('placeholder', 'What needs to be done?'),
                      UI.attribute('autofocus', ''),
                      UI.attribute('value', input),
                      // Map events to the derived facts
                      UI.on('input', self, '/on/change'),
                      UI.on('keydown', self, '/on/keydown'),
                    ]),
                    UI.section(
                      [UI.attribute('class', 'main')],
                      [...items.map((item) => UI.gem(Todo, item))]
                    ),
                  ]
                ),
              ]
            ),
          ],
        ]
      ),
    },
  },

  /**
   * This behavior is triggered when input field in the UI is changed.
   */
  updateInput: {
    where: [
      ['?', '/on/change', '?event'],
      ['?event', 'type', 'input'],
      ['?event', 'target', '?target'],
      ['?target', 'value', '?input'],
    ],
    /**
     * In this instance we just deduce facts using datalog query itself without
     * having to write an js code.
     */
    update: {
      type: 'application/datalog+json',
      content: [[['?', 'todo/draft', '?input']]],
    },
  },

  /**
   * This behavior is triggered when user hits "Enter" key in the input field
   * of our view.
   *
   * @typedef {object} CreateEnteredItem
   * @property {DB.Entity} self
   * @property {string} title
   */
  createEnteredItem: {
    select: {
      self: '?',
      title: '?title',
    },

    where: [
      // when we got an event on keydown
      ['?', '/on/keydown', '?event'],
      // and event type is "keydown"
      ['?event', 'type', 'keydown'],
      // and event.key == "Enter"
      ['?event', 'key', 'Enter'],
      // we capture the current input
      ['?', 'todo/draft', '?title'],
    ],
    update: {
      type: 'application/javascript',

      url: URL.from(
        /**
         * @param {CreateEnteredItem} model
         */
        ({ self, title }) => {
          // Create new entity
          const todo = {}
          return [
            // Associate it with self
            [todo, 'todo/list', self],
            [todo, 'title', title],
            // Reset current input
            [self, 'todo/draft', ''],
          ]
        }
      ),
    },
  },

  /**
   * This behavior is triggered whenever 'todo/draft' contains line break, which
   * e.g. may happen if some other gem updates that attribute outside of our
   * view logic.
   */
  createOnLineBreak: {
    /**
     * @typedef {object} CreateOnLineBreak
     * @property {DB.Entity} self
     * @property {string} title
     */
    select: {
      self: '?',
      title: '?title',
    },

    where: [
      ['?', 'todo/draft', '?title'],
      // Custom predicate relation.
      ['?title', '.includes', '\n'],
    ],
    update: {
      type: 'application/javascript',

      url: URL.from(
        /**
         * @param {CreateEnteredItem} model
         */
        ({ self, title }) =>
          title
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .flatMap((title) => {
              // Create new entity
              const todo = {}
              return [
                // Associate it with self
                [todo, 'todo/list', self],
                [todo, 'title', title.trim()],
                // Reset current input
                [self, 'todo/draft', ''],
              ]
            })
      ),
    },
  },

  /**
   * Occurs when user clicks delete button on a todo list item.
   */
  deleteItem: {
    /**
     * @typedef {object} DeleteItem
     * @property {DB.Entity} self
     * @property {DB.Entity} item
     */
    select: {
      self: '?',
      item: '?item',
    },
    where: [
      ['?item', 'todo/list', '?self'],
      ['?item', 'deleted', true],
    ],
    /**
     *
     * @param {DeleteItem} input
     */
    update: ({ self, item }) => [
      // retract this association
      { retract: [item, 'todo/list', self] },
    ],
  },

  /**
   * We prompt LLM when user updates the input field.
   */
  prompt: {
    /**
     * @typedef {object} Prompt
     * @property {DB.Entity} self
     * @property {string} input
     */
    select: {
      self: '?',
      input: '?input',
    },
    // selection criteria defined in terms of relations
    where: [['?', 'todo/draft', '?input']],
    update: {
      type: 'application/javascript',

      url: URL.from(
        /**
         * When selection changes our update function is triggered and
         * /common/ui relation is derived
         *
         * @param {Prompt} model
         */ ({ self, input }) => {
          const fx = HTTP.request({
            url: `https://api.claude.ai/v1/ask?prompt=${input}`,
          })

          return [[self, 'fx/prompt', fx]]
        }
      ),
    },
  },
  promptResult: {
    /**
     * @typedef {object} PromptResult
     * @property {DB.Entity} self
     * @property {string} output
     */
    select: {
      self: '?',
      output: '?input',
    },
    // selection criteria defined in terms of relations
    where: [
      ['?', 'fx/prompt', '?fx'],
      ['?', 'result/ok', '?output'],
    ],
    update: {
      type: 'application/javascript',

      url: URL.from(
        /**
         * When selection changes our update function is triggered and
         * /common/ui relation is derived
         *
         * @param {PromptResult} model
         */
        ({ self, output }) => [[self, 'todo/draft/note', output]]
      ),
    },
  },

  autocomplete: {
    /**
     * @typedef {object} Autocomplete
     * @property {DB.Entity} self
     * @property {string} input
     */
    select: {
      self: '?',
      input: '?input',
    },
    // selection criteria defined in terms of relations
    where: [['?', 'todo/draft', '?input']],
    update: {
      type: 'application/javascript',

      url: URL.from(
        /**
         * When selection changes our update function is triggered and
         * /common/ui relation is derived
         *
         * @param {Autocomplete} model
         */
        ({ self, input }) => {
          return [[self, '/common/effect', Behavior.spawn(Autocomplete, self)]]
        }
      ),
    },
  },
}
