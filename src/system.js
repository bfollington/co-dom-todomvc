import * as DB from './db.js'
import * as UI from './ui.js'

/**
 * @template {Record<string, any>} Source
 * @param {{[K in keyof Source]: Behavior<Source[K]>}} behavior
 * @returns {{[K in keyof Source]: Behavior<Source[K]>}}
 */
export const be = (behavior) => behavior

/**
 * @template {DB.Selector} [Select=DB.Selector]
 * @typedef {object} Behavior
 * @property {DB.Clause[]} where
 * @property {Select} select
 * @property {(input:DB.InferBindings<Select>) => DB.Transaction} update
 */

/**
 * @template {DB.Selector} Select
 * @typedef {{
 *   select: Select
 *    where: DB.Clause[]
 *   update(me:Be<Select>): DB.Transaction
 * }} Be
 */

/**
 * @typedef {object} Session
 * @property {HTMLElement} mount
 * @property {Record<string, Behavior>} as
 * @property {DB.Entity} entity
 * @property {DB.Querier & DB.Transactor} db
 * @property {Record<string, any>} state
 */

/**
 * @param {object} input
 * @param {Record<string, Behavior>} input.as
 * @param {DB.Entity} [input.entity]
 * @param {Record<string, any>} [input.state]
 * @param {HTMLElement} [input.mount]
 */
export const launch = ({
  as,
  entity = DB.Constant.Link.of({}),
  state = Object.create(null),
  mount = document.body.appendChild(document.createElement('noscript')),
}) => {
  const db = DB.Memory.create([[entity, 'complete', false]])

  const session = {
    as,
    entity,
    db,
    state,
    mount,
  }

  run(session)
}

/**
 * @param {Session} session
 */
export const run = async (session) => {
  console.groupCollapsed('📫 Evaluate behaviors', session.as)
  while (true) {
    const changes = step(session)
    if (changes.length > 0) {
      await session.db.transact(changes)
    } else {
      break
    }
  }
  console.groupEnd()

  render(session)
}

/**
 * @param {object} input
 * @param {DB.Entity} input.entity
 * @param {Record<string, Behavior>} input.as
 * @param {DB.Querier & DB.Transactor} input.db
 * @param {Record<string, any>} input.state
 * @returns
 */
export const step = ({ entity, as, db, state }) => {
  /** @type {DB.Clause[]} */
  const context = [{ Is: [DB.self, entity] }]
  const translation = []

  for (const [name, { select, where, update }] of Object.entries(as)) {
    const frames = DB.query(db, {
      select,
      where: [...context, ...where],
    })

    if (frames.length === 0) {
      console.log(`📭 %c Mismatch /${name}/*`, 'color: red')
    }

    for (const [id, frame] of frames.entries()) {
      const hash = DB.Constant.Link.of(frame).toString()
      const at = `/${name}/${id}`
      if (state[at] != hash) {
        console.log(`📬 %cUpdate ${at} != ${hash}`, 'color: green', frame)
        state[at] = hash
        const changes = update(frame)
        translation.push(...changes)
      } else {
        console.log(`📪 %cSkip ${at} == ${hash}`, 'color: grey', frame)
      }
    }
  }

  return translation
}

/**
 * @param {Session} session
 * @param {[DB.Entity, string, object]} fact
 */
export const dispatch = async (session, fact) => {
  // First we associate event
  await session.db.transact([UI.assert(fact)])
  // Then we perform one step and retract the fact.
  // ⚠️ This is important, otherwise we may end up in a runaway loop
  // e.g. when we have selector that increments count on clicks. It
  // select `count` in order to increment and select click event to
  // react and update the count. Since count is updated it will re-run
  // behavior incrementing count again and so on. By retracting handled
  // event we break such loops.
  const transaction = [UI.retract(fact), ...step(session)]
  // Clear up event
  await session.db.transact(transaction)
  // And rerun the system
  run(session)
}

/**
 *
 * @param {Session} session
 */
export const render = (session) => {
  /** @type {DB.Term<UI.Ref<UI.Node<[DB.Entity, string, object]>>>} */
  const ui = DB.variable()
  const [match] = DB.query(session.db, {
    select: { ui },
    where: [{ Case: [session.entity, '/common/ui', ui] }],
  })

  if (match) {
    match.ui
    const ui = UI.unwrap(match.ui)
    if (session.state['/common/ui'] == null) {
      document.createElement('div')
      session.state['/common/ui'] = UI.virtualize(session.mount)
    }

    if (session.state['/common/ui'] != ui) {
      const delta = UI.diff(session.state['/common/ui'], ui)
      session.state['/common/ui'] = ui
      const mount = UI.patch(session.mount, ui, delta, {
        /**
         * @param {[DB.Entity, string, object]} fact
         */
        send(fact) {
          dispatch(session, fact)
        },
      })
      // types are incorrect
      session.mount = /** @type {any} */ (mount)
    }
  }
}
