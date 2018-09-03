/**
 * Testing of TaskRunner
 */

const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars
const assert = require('assert');

const TaskRunner = require('../lib/taskrunner');

describe('TaskRunner tests', function() {
  this.timeout(10000);

  const jobs = [];
  const jobCount = 100;
  const resourceCount = 5;
  let doneJobs = 0;
  const usedResources = new Map();

  for (let i = 0; i < jobCount; i++) {
    const delay = Math.floor(100 * Math.random());

    // jobs for TaskRunner, when called, return a promise. The test
    // job just introduces a random delay, and also adds some tracking
    // information fo the test.
    jobs.push(function(resource) {
      // console.log(`starting job with delay ${delay}`);

      // track resource usage
      if (!usedResources.has(resource)) {
        usedResources.set(resource, 0);
      }
      usedResources.set(resource, usedResources.get(resource) + 1);

      return new Promise((resolve, reject) => {
        // pass delay to the resource so that, if desired, it can associate its use
        // with a particular job, identified by delay.
        resource(delay);

        setTimeout(() => {
          // console.log(`job delay ${delay} ending`);
          doneJobs++;
          resolve();
        }, delay);
      });
    });
  }

  // our test resource simply prints out (unless commented out) tracking info.
  const resources = [];
  for (let i = 0; i < resourceCount; i++) {
    resources.push(n => {
      // console.log(`used resource ${i} in job ${n}`);
    });
  }

  it('works', async function() {
    const taskRunner = new TaskRunner();
    resources.forEach(resource => taskRunner.addResource(resource));
    jobs.forEach(job => taskRunner.addTask(job));
    await taskRunner.promiseDone();

    // console.log('resource usage: ' + prettyFormat(usedResources));
    // console.log(`doneJobs: ${doneJobs}`);
    assert(doneJobs === jobCount, 'jobCount accounts for all jobs');
    assert(usedResources.size === resourceCount, 'All resources used');
    usedResources.forEach((value, key) => {
      assert(value > 2, 'all resouces used reused at least once');
    });
  });
});
