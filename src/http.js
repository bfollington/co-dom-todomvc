/**
 * @param {object} input
 * @param {string} input.url
 * @param {string} [input.method='GET']
 */
export const request = ({ url, method = 'GET' }) => ({
  '/common/effect': {
    service: 'http',
    method,
    url,
  },
})
