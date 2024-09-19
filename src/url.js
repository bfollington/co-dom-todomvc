/**
 * @param {Function} fn
 */
export const from = (fn) =>
  new URL(`data:application/javascript;export default fn.toString())`)
