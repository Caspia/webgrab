// Test the getHeader module
const getHeaders = require('../lib/getHeaders');
const assert = require('assert');

describe('getHeaders', function() {
  it('gets non-html type', async function() {
    const headers = await getHeaders('http://code.jquery.com/jquery-3.3.1.js');
    console.log('content-type: ' + headers.get('Content-Type'));
    assert(headers.get('Content-Type').startsWith('application/javascript', 'gets javascript type'));
  });

  it('gets http type', async function() {
    const headers = await getHeaders('https://nodejs.org');
    console.log('content-type: ' + headers.get('Content-Type'));
    assert(headers.get('Content-Type').startsWith('text/html'), 'returns html type');
  });


});
