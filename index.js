const prettyFormat = require('pretty-format');
const URL = require('url').URL;
const getHeaders = require('./lib/getHeaders');
const fetch = require('node-fetch');

/* */
var webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until;

var driver = new webdriver.Builder()
    .forBrowser('firefox')
    .build();

const seenSites = new Set();
const pendingSites = new Set();
const siteQueue = [];
/* */

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let siteList = [
  {
    site: "https://nodejs.org",
    getChildren: true,
    dontGetChildren: [],
    alsoGetChildren: [],
    expandChildren: false,
    dontExpandChildren: [/download\/releases/],
    alsoExpandChildren: [/newsletter\.npmjs\.org/],
  },
];

function normalizeSiteList(siteList) {
  const siteDefault = {
    site: '',
    getChildren: true,
    alsoGetChildren: [],
    dontGetChildren: [],
    expandChildren: true,
    alsoExpandChildren: [],
    dontExpandChildren: []
  }

  const newSiteList = [];
  siteList.forEach(site => {
    const siteObject = clone(siteDefault);
    if ((typeof site) === 'string') {
      // site is just the uri, use defaults
      siteObject.site = site;
    } else {
      if (!(typeof site === 'object')) {
        throw new Error(`items in the site list must be strings or objects: ${prettyFormat(site)}`);
      }
      // fill in set values
      if (!site.site) {
        throw new Error(`items in the site list must include the site uri: ${prettyFormat(site)}`);
      }
      for (property in site) {
        siteObject[property] = site[property];
      }
    }
    newSiteList.push(siteObject);
  });
  return newSiteList;
}

siteList = normalizeSiteList(siteList);

async function loadURI(uri) {
  try {
    console.log('loading ' + uri);
    const headers = await getHeaders(uri);
    const contentType = headers.get('Content-Type');
    console.log('uri content type is ' + contentType);
    // Don't ask ask the browser to download non-html
    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      // download anyway to cache
      console.log('Using fetch to cache non-html uri ' + uri);
      const response = fetch(uri);
      return [];
    }
    const hrefUris = new Set();
    await driver.get(uri);
    const documentURI = await driver.executeScript('return document.documentURI');
    console.log(`documentURI is ${documentURI}`);
    const documentContentType = await driver.executeScript('return document.contentType');
    console.log(`contentType is ${documentContentType}`);

    const elements = await driver.findElements(By.css('a'));
    console.log(`elements.length is ${elements.length}`);
    const promiseNames = [];
    elements.forEach(element => {
      promiseNames.push(driver.executeScript('return arguments[0].getAttribute("href")', element));
    });
    const hrefs = await Promise.all(promiseNames);
    hrefs.forEach(href => {
      if (href === '#') return;
      const uriObj = new URL(href, documentURI);
      // references are dups
      uriObj.hash = '';
      hrefUris.add(uriObj.toString());
    });
    const entries = [];
    hrefUris.forEach(entry => entries.push(entry));
    return entries;
  } catch(err) {console.log(err);}
}

/* */
(async function doit () {
  siteList.forEach(siteItem => {
    const uri = siteItem.site;
    if (!pendingSites.has(uri)) {
      pendingSites.add(uri);
      siteQueue.push(siteItem);
    }
  });

  for (let siteItem = siteQueue.shift(); siteItem; siteItem = siteQueue.shift()) {
    const uri = siteItem.site;
    console.log('uri is ' + uri);
    pendingSites.delete(uri);
    seenSites.add(uri);
    const siteRefs = await loadURI(uri);
    console.log(`found ${siteRefs.length} refs`);
    const uriObj = new URL(uri);
    const currentHost = uriObj.host;

    if (siteItem.getChildren) {
      siteRefs.forEach(ref => {
        const refObject = new URL(ref);
        let getMe = false;
        // by default, get if hosts match
        if (refObject.host === currentHost) getMe = true;
        // but allow certain other sites
        siteItem.alsoGetChildren.forEach(regex => {
          if (regex.test(ref)) {
            getMe = true;
          }
        })
        // but reject certain other sites
        siteItem.dontGetChildren.forEach(regex => {
          if (regex.test(ref)) {
            getMe = false;
          }
        });
        if (getMe && !seenSites.has(ref) && !pendingSites.has(ref)) {
          pendingSites.add(ref);
          let expandChildren = siteItem.expandChildren;
          siteItem.alsoExpandChildren.forEach(regex => {
            if (regex.test(ref)) {
              expandChildren = true;
            }
          });
          siteItem.dontExpandChildren.forEach(regex => {
            if (regex.test(ref)) {
              expandChildren = false;
            }
          })
          childItem = clone(siteItem);
          childItem.site = ref;
          childItem.getChildren = expandChildren;
          siteQueue.push(childItem);
        }
      });
    }
    console.log(`siteQueue length is ${siteQueue.length}`);
  }
  driver.quit();
})();

/* */
