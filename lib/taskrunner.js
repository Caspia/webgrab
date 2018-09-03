/**
 * Manages a queue of async tasks that depend on a pool of resources.
 */

const prettyFormat = require('pretty-format'); // eslint-disable-line no-unused-vars

function TaskRunner() {
  // resources made available to TaskRunner that can be supplied to jobs when free
  this._resourcePool = [];
  // queue of tasks waiting to be run
  this._taskQueue = [];
  // list of resources not currently in use, so available for jobs to use
  this._freeResourcePool = [];
  // count of tasks with running (that is not completed) jobs.
  this._activeTaskCount = 0;
}

/**
 * A task do be run under TaskRunner, including the metadata needed by TaskRunner to keep track of its status
 * @typedef {object} Task
 * @property {Job} job - the function supplied by the calling program that accomplishes the work needed by the task
 * @property {*} resource - opaque item needed by job to do its work
 */

/**
  * function supplied by the calling program to accomplish some async work. The function takes as a single
  * parameter a resource, and returns a Promise.
  * @typedef {function(*):Promise} Job
  */

TaskRunner.prototype = {
  // Public methods

  /**
   * adds a resource (which is an opaque item to be used by jobs) to a list of resources
   * available for use by the TaskRunner.
   *
   * @param resource{*} - an opaque item used by jobs. The resource can be used by only one job at a time,
   *   but once the job is done the resource can be reused by another job.
   */
  addResource: function(resource) {
    this._resourcePool.push(resource);
    this._freeResource(resource);
  },
  promiseDone() {
    return new Promise((resolve, reject) => {
      if (!this._activeTaskCount && !this._taskQueue.length) {
        console.log('promiseDone done immedeitately')
        resolve();
      } else {
        this._onDone = () => resolve();
      }
    });
  },
  /**
   * Add a task to run a job to a queue of tasks needing running
   * @param {Job} job - the function to run to accomplish the task
   */
  addTask(job, callback) {
    const task = {job: job, callback: callback};
    this._taskQueue.push(task);
    if (this._freeResourcePool.length) {
      this._startTask(this._taskQueue.shift(), this._freeResourcePool.shift());
    }
  },

  // Private methods

  /**
   * declare a resource as available for use by a job
   * @private
   * @param resource - see addResource
   */
  _freeResource(resource) {
    this._freeResourcePool.push(resource);
    if (this._taskQueue.length) {
      this._startTask(this._taskQueue.shift(), this._freeResourcePool.shift());
    }
  },
  /**
   * Start running a task with a particular resource
   * @private
   * @param {Task} task - the task to start
   * @param {*} resource - the resource to by used by the task's job
   */
  _startTask(task, resource) {
    task.resource = resource;

    // actually start running the task
    this._activeTaskCount++;
    let promise = task.job(resource);
    if (task.callback) {
      promise = promise.then(task.callback.onFulfilled, task.callback.onRejected);
    }
    promise.then(() => this._endTask(task));
  },
  /**
   * Do TaskRunner operations to process the end of a task.
   * @private
   * @param {Task} task - the task that ended
   */
  _endTask(task) {
    this._activeTaskCount--;

    // this._onDone is only set if there is an active promise waiting for a notification
    // that we are done.
    if (this._onDone && this._activeTaskCount === 0 && this._taskQueue.length === 0) {
      this._onDone();
    }
    this._freeResource(task.resource);
  }
};

module.exports = TaskRunner;
