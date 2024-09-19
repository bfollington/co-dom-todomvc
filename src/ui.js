export * from '@gozala/co-dom'
import * as DOM from '@gozala/co-dom'
import * as DB from 'datalogia'

/**
 *
 * @param {DOM.EncodedEvent['type']} event
 * @param {DB.Entity} entity
 * @param {string} [attribute]
 */
export const on = (event, entity, attribute = `/on/${event}`) =>
  DOM.on(event, {
    /**
     *
     * @param {DOM.EncodedEvent} event
     */
    decode(event) {
      return {
        message: /** @type {DB.Fact} */ ([
          entity,
          attribute,
          /** @type {any & DB.Entity} */ (event),
        ]),
      }
    },
  })

/**
 *
 * @param {object} behavior
 * @param {DB.Entity} entity
 * @returns
 */
export const gem = (behavior, entity) =>
  DOM.customElement('gem', Gem, [
    DOM.property('entity', entity),
    DOM.property('behavior', behavior),
  ])

class Gem extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }
}

/**
 * @template {{}} T
 * @typedef {DB.API.Link<T>} Ref
 */
/**
 * @template {{}} T
 * @param {Ref<T>} ref
 * @returns {T}
 */
export const unwrap = (ref) => /** @type {any} */ (ref).value

const UTF8_ENCODER = new TextEncoder()

/**
 * Returns transaction that retracts the fact and then asserts it. This works
 * around current system limitation, namely:
 *
 * Non scalars can not be used in facts, so we derive refs from the
 * `[entity, attribute]` pair instead and use it in place of actual value.
 * Consumers can use `unwrap` to dereference the value.
 *
 * @template T
 * @param {[entity: DB.Entity, attribute:string, value: T]} fact
 * @returns {DB.Transaction}
 */
export const swap = ([entity, attribute, value]) => {
  const ref = Object.assign(DB.Constant.Link.of([entity, attribute, {}]), {
    value,
  })

  return [
    { Disassociate: [entity, attribute, ref] },
    { Associate: [entity, attribute, ref] },
  ]
}

/**
 * @template T
 * @param {[entity: DB.Entity, attribute:string, value: T]} fact
 * @returns {{Associate: [DB.Entity, string, Ref<T>]}}
 */
export const assert = ([entity, attribute, value]) => ({
  Associate: [
    entity,
    attribute,
    Object.assign(DB.Constant.Link.of([entity, attribute, {}]), {
      value,
    }),
  ],
})

/**
 * @template T
 * @param {[entity: DB.Entity, attribute:string, value: T]} fact
 * @returns {DB.Instruction}
 */
export const retract = ([entity, attribute, value]) => ({
  Disassociate: [
    entity,
    attribute,
    Object.assign(DB.Constant.Link.of([entity, attribute, {}]), {
      value,
    }),
  ],
})
