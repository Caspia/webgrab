const fetch = require('node-fetch');

async function getHeaders(uri) {
  const response = await fetch(uri, {method: 'HEAD'});
  return response.headers;
}

module.exports = getHeaders;
