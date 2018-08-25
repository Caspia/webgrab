/**
 * Load websites and links to populate an offline cache.
 * @file
 * @author R. Kent James <kent@caspia.com>
 *
 * Usage: node index.js <someConfigFile.json>
 * (If the config file is omitted,defauts to config.json)
 */

const prettyFormat = require('pretty-format');
const clone = require('clone');
const URL = require('url').URL;
const fetch = require('node-fetch');
const fs = require('fs-extra');
const webdriver = require('selenium-webdriver');
const chalk = require('chalk');

const getHeaders = require('./lib/getHeaders');
const By = webdriver.By;

/**
 * @typedef SiteItem Object representing a uri to get and handling of its ref expansions
 * @type {Object}
 * @property site {string} - the uri to get
 * @property getChildren {boolean} - should we also get the children of this uri?
 * @property alsoGetChildren {RegExp[]|string} - additional uri references to get, that do not match the
 *   host of the main site uri. These regular expressions are applied to the reference uri. Strings should
 *   be representations of a regular expressions, and are converted internally to regular expressions.
 *   (Applies to alsoGetChildren, dontGetChildren, alsoExpandChildren, and dontExpandChildren)
 * @property dontGetChildren {RegExp[]|string} - uri references to reject getting
 * @property expandChildren {true} - should we expand the references of this site's children?
 * @property alsoExpandChildren {RegExp[]|string} - uri references to also expand that do not match the site host
 * @property dontExpandChildren {RegExp[]|string} - uri references to reject expanding
 */

/**
 * Given a list of uris (strings or objects), convert to objects, adding defaults. Also converts strings
 * to regular expressions where appropriate.
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
      // convert string regexp to objects
      for (const name of ['alsoGetChildren', 'dontGetChildren', 'alsoExpandChildren', 'dontExpandChildren']) {
        if (site[name]) {
          const nameArray = [];
          site[name].forEach(item => {
            if (typeof item === 'string') {
              nameArray.push(new RegExp(item, 'i'));
            } else {
              nameArray.push(site[name]);
            }
          });
          site[name] = nameArray;
        }
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

/**
 * loads a uri from the web
 * @param {string} uri the uri to load
 * @param {ThenableWebDriver} driver Selenium web driver object.
 * @returns {string[]} array of uri references from the <a> tags in the website
 * @see {@link {http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/}}
 */
async function loadURI(uri, driver) {
  try {
    console.log(chalk.green('loading ' + uri));
    const headers = await getHeaders(uri);
    const contentType = headers.get('Content-Type');
    // Don't ask ask the browser to download non-html
    if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      // download anyway to cache
      console.log('Content-type: ' + contentType + ' Using fetch to cache non-html uri ' + uri);
      await fetch(uri);
      return [];
    }
    const hrefUris = new Set();
    await driver.get(uri);
    const documentURI = await driver.executeScript('return document.documentURI');

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
  // Get the configuration file path from the cli, or use a default.
  const [configFileCli] = process.argv.slice(2);
  const configFile = configFileCli || 'config.json';

  // read the configuration from a file
  console.log('configFile is ' + configFile);
  const siteList = normalizeSiteList(JSON.parse(fs.readFileSync(configFile)));

  // setup Selenium
  const driver = new webdriver.Builder()
    .forBrowser('firefox')
    .build();

  // The main objects controlling sites to get.
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
    // load the uri for the current item, getting the references
    const uri = siteItem.site;
    pendingSites.delete(uri);
    const siteRefs = await loadURI(uri, driver);
    seenSites.add(uri);

    // manage handling of child references of this site
    const uriObj = new URL(uri);
    const currentHost = uriObj.host;

    if (siteItem.getChildren) {
      siteRefs.forEach(ref => {
        if (seenSites.has(ref) || pendingSites.has(ref)) {
          return; // already processed this site
        }

        // Should we get this reference uri?
        const refObject = new URL(ref);
        // by default, get if hosts match
        let getMe = refObject.host === currentHost;
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

        if (getMe) {
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
          pendingSites.add(ref);
          siteQueue.push(childItem);
        }
      });
    }
    console.log(chalk.bgBlue(`siteQueue length is ${siteQueue.length}`));
  }
  driver.quit();
}

main();
