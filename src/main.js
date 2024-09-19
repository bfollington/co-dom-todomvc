import * as System from './system.js'

/**
 * @param {Document} target
 */
export const activate = (target) => {
  console.log('Activating', target)

  const params = new URLSearchParams(document.location.search)
  console.log(params.get('as'))
  const as = params.get('as')
  if (as) {
    load(as)
  }
}

/**
 *
 * @param {string} behavior
 */
const load = async (behavior) => {
  const url = new URL(behavior, import.meta.url)
  const module = await import(url.href)
  System.launch({ as: module.default })
}

export const main = () => {
  window.addEventListener('DOMContentLoaded', (event) => {
    activate(/** @type {Document} */ (event.target))
  })
}

main()
