import * as DB from 'datalogia'

/**
 * @param {object} behavior
 * @param {DB.Entity} entity
 */
export const spawn = (behavior, entity) => ({
  '/common/effect': {
    service: 'behavior',
    behavior,
    entity,
  },
})
