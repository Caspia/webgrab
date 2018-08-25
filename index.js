/**
 * Load websites and links to populate an offline cache.
 * @file
 * @author R. Kent James <kent@caspia.com>
 */

const prettyFormat = require('pretty-format');
const URL = require('url').URL;
const getHeaders = require('./lib/getHeaders');
const fetch = require('node-fetch');

const webdriver = require('selenium-webdriver');
const By = webdriver.By;

/**
 * Clone a simple js object
 * @param {Object} obj  the object to clone
 * @returns {Object} the cloned of the object
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let siteList = [
  {
    site: 'https://nodejs.org',
    getChildren: true,
    dontGetChildren: [],
    alsoGetChildren: [],
    expandChildren: false,
    dontExpandChildren: [/download\/releases/],
    alsoExpandChildren: [/newsletter\.npmjs\.org/]
  }
];

/**
 * @typedef SiteItem Object representing a uri to get and handling of its ref expansions
 * @type {Object}
 * @property site {string} - the uri to get
 * @property getChildren {boolean} - should we also get the children of this uri?
 * @property alsoGetChildren {RegExp[]} - additional uri references to get, that do not match the
 *   host of the main site uri. These regular expressions are applied to the reference uri.
 * @property dontGetChildren {RegExp[]} - uri references to reject getting
 * @property expandChildren {true} - should we expand the references of this site's children?
 * @property alsoExpandChildren {RegExp[]} - uri references to also expand that do not match the site host
 * @property dontExpandChildren {RegExp[]} - uri references to reject expanding
 */
/**
 * Given a list of uris (strings or objects), convert to objects, adding defaults
 * @param {Array.<SiteItem|string>} siteList list of web uris, with optional expansion parameters. Strings
 *   are to use the default ref expansion options.
 * @returns {SiteItems[]} Converted string uris to SiteItem, also fills in missing defaults.
 */
function normalizeSiteList(siteList) {
  const siteDefault = {
    site: '',
    getChildren: true,
    alsoGetChildren: [],
    dontGetChildren: [],
    expandChildren: true,
    alsoExpandChildren: [],
    dontExpandChildren: []
  };

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
      for (const property in site) {
        siteObject[property] = site[property];
      }
    }
    newSiteList.push(siteObject);
  });
  return newSiteList;
}

siteList = normalizeSiteList(siteList);

/**
 * loads a uri from the web
 * @param {string} uri the uri to load
 * @param {ThenableWebDriver} Selenium web driver object.
 * @returns {string[]} array of uri references from the <a> tags in the website
 * @see {@link {http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/}}
 */
async function loadURI(uri, driver) {
  try {
    console.log('loading ' + uri);
    const headers = await getHeaders(uri);
    const contentType = headers.get('Content-Type');
    console.log('uri content type is ' + contentType);
    // Don't ask ask the browser to download non-html
    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      // download anyway to cache
      console.log('Using fetch to cache non-html uri ' + uri);
      await fetch(uri);
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
  } catch (err) {
    console.log(err);
  }
}

/**
 * The main method of this script
 * @function
 */
async function main() {
  const driver = new webdriver.Builder()
    .forBrowser('firefox')
    .build();

  const seenSites = new Set();
  const pendingSites = new Set();
  const siteQueue = [];

  // Queue the starting list of sites for processing.
  siteList.forEach(siteItem => {
    const uri = siteItem.site;
    if (!pendingSites.has(uri)) {
      pendingSites.add(uri);
      siteQueue.push(siteItem);
    }
  });

  // Main loop to process sites
  for (let siteItem = siteQueue.shift(); siteItem; siteItem = siteQueue.shift()) {
    const uri = siteItem.site;
    console.log('uri is ' + uri);
    pendingSites.delete(uri);
    seenSites.add(uri);
    const siteRefs = await loadURI(uri, driver);
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
        });
        // but reject certain other sites
        siteItem.dontGetChildren.forEach(regex => {
          if (regex.test(ref)) {
            getMe = false;
          }
        });

        if (getMe && !seenSites.has(ref) && !pendingSites.has(ref)) {
          pendingSites.add(ref);

          // set the child getChildren option based on the parent expandChildren
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
          });
          const childItem = clone(siteItem);
          childItem.site = ref;
          childItem.getChildren = expandChildren;
          siteQueue.push(childItem);
        }
      });
    }
    console.log(`siteQueue length is ${siteQueue.length}`);
  }
  driver.quit();
}

main();
