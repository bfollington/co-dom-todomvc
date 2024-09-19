import * as DB from './db.js'
import * as UI from './ui.js'

/**
 * @typedef {object} OpenDocument
 * @property {Document} document
 * @property {Behavior} [as]
 * @property {DB.Entity} [entity]
 * @property {DB.Querier & DB.Transactor} [db]
 *
 * @param {{Document: OpenDocument}} input
 */
export const open = async (input) => {
  if (input.Document) {
    const { document, as, entity, db } = input.Document
    const params = new URLSearchParams(document.location.search)
    const session = {
      state: Object.create(null),
      entity: entity ?? openEntity(params),
      as: as ?? (await openBehavior(params)),
      db: db ?? (await openDatabase(params)),
      mount: document.createElement('noscript'),
    }
    await onInteractive(document)
    document.body.appendChild(session.mount)
    await run(session)
  }
}

/**
 * @param {Document} document
 * @returns {Promise<unknown>}
 */
const onInteractive = async (document) => {
  switch (document.readyState) {
    case 'loading':
      return new Promise((resolve) =>
        document.addEventListener('DOMContentLoaded', resolve)
      )
    case 'interactive':
      return {}
    case 'complete':
      return {}
  }
}

/**
 * @param {URLSearchParams} params
 */
const openBehavior = (params) =>
  loadBehavior(params.get('as') ?? './todo.behavior.js')

/**
 * @param {string} as
 * @returns {Promise<Behavior>}
 */
const loadBehavior = async (as) => {
  if (as.length > 0) {
    const url = new URL(as, import.meta.url)
    const module = await import(url.href)
    return module.default
  } else {
    throw new Error('Behavior must be specified using `as` query parameter.')
  }
}

/**
 * @param {URLSearchParams} params
 */
export const openEntity = (params) => {
  const entity = params.get('entity') ?? ''
  if (entity.length > 0) {
    return DB.Constant.Link.fromJSON({ '/': entity })
  } else {
    return DB.Constant.Link.of({})
  }
}

/**
 *
 * @param {URLSearchParams} params
 */
export const openDatabase = async (params) => {
  // TODO: Actually use some database here
  return DB.Memory.create([])
}

/**
 * This function does not serve any other purpose but to activate TS type
 * inference specifically it ensures that rule `update` functions infer it's
 * arguments from the rules `select`.
 *
 * @template {Record<string, any>} Source
 * @param {{[K in keyof Source]: Rule<Source[K]>}} behavior
 * @returns {{[K in keyof Source]: Rule<Source[K]>}}
 */
export const be = (behavior) => behavior

/**
 * Behavior is a set of named rules for an entity referenced by the `?`
 * variable that defines its behavior in relation to state changes.
 *
 * @template {Record<string, any>} [Rules=Record<string, Rule>]
 * @typedef {{[Name in keyof Rules]: Rule<Rules[Name]['select']>}} Behavior
 */

/**
 * Rule defines a specific behavior for an entity referenced by the `?`
 * variable. It provides a selector to query entity and relevant relations
 * and provides an update logic that submits new facts to the database when
 * when result of the selector changes.
 *
 * @template {DB.Selector} [Select=DB.Selector]
 * @typedef {object} Rule
 * @property {DB.Clause[]} where
 * @property {Select} select
 * @property {(input:DB.InferBindings<Select>) => DB.Transaction} update
 */

/**
 * Represents state of the activated entity in the running system.
 *
 * @template {Record<string, any>} [Model=Record<string, any>]
 * @typedef {object} Session
 * @property {DB.Entity} entity - Entity session operates on.
 * @property {Behavior} as - Behavior used by the session.
 * @property {HTMLElement} mount - Target HTML element session is rendered into.
 * @property {DB.Querier & DB.Transactor} db - Database session operates on.
 * @property {Model} state - State of the session.
 */

/**
 * Runs the session update cycle. It will evaluate behavior rules and update db
 * with new facts and repeat the cycle until no new facts are derived. At the
 * end of the cycle updated session state is rendered into the DOM.
 *
 * ℹ️ User interaction with DOM kick off new run update cycles.
 *
 * @param {Session} session
 */
export const run = async (session) => {
  console.groupCollapsed('📫 Evaluate behaviors', session.as)
  // Evaluates session behavior rules and transacts new derived facts until
  // no new facts are produced.
  while (true) {
    const changes = evaluate(session)
    if (changes.length > 0) {
      await session.db.transact(changes)
    } else {
      break
    }
  }
  console.groupEnd()

  // Once update loop has settled renders the session into the DOM.
  render(session)
}

/**
 * Evaluates session by computing rule selectors and running update functions
 * for the rules whose selectors produced different results. All updates are
 * collected into a list of instructions and returned by the function.
 *
 * @param {Session} input
 */
export const evaluate = ({ entity, as, db, state }) => {
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
 * Dispatches a fact produced by the event listener onto the session, which will
 * kick off the new run loop cycle.
 *
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
  const transaction = [UI.retract(fact), ...evaluate(session)]
  // Clear up event
  await session.db.transact(transaction)
  // And rerun the system
  run(session)
}

/**
 * Renders entities `/common/ui` attribute into the session mount point, wiring
 * event listeners such they will dispatch derived facts onto the session.
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
