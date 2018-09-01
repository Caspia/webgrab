/**
 * @module getHeaders
 */

const fetch = require('node-fetch');

/**
 * get the http headers for a uri
 *
 * @param {string} uri the web resource to fetch
 * @returns {Headers} the web Headers object for the uri
 */
async function getHeaders(uri) {
  console.log(`uri in headers: ${uri}`);
  const response = await fetch(uri,
    {
      method: 'HEAD',
      headers: {
        Connection: 'keep-alive',
        Accept: 'text/html, application/xhtml+xml'
      }
    });
  return response.headers;
}

module.exports = getHeaders;
