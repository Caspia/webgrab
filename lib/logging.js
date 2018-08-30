/**
 * Logging management
 * @module logging
 */

const winston = require('winston');
const fs = require('fs-extra');
var log = 'Please configure me';

/**
 * Setup logging, including capturing exit precursor events to flush logs
 * @param {string} logFilesPath File system path to the directory to contain the logs
 * @returns {Function} winston logger
 */
function setupLogging(logFilesPath) {
  const { createLogger, format, transports } = winston;
  const { combine, timestamp, printf } = format;
  const fileFormat = printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
  });
  const consoleFormat = printf(info => {
    return `${info.level}: ${info.message}`;
  });

  if (!fs.existsSync(logFilesPath)) {
    fs.ensureDirSync(logFilesPath);
  }

  const logFileTransport = new transports.File(
    {
      filename: logFilesPath + '/webgrab.log',
      maxsize: 1000000,
      maxFiles: 3
    }
  );
  log = createLogger({
    level: 'debug',
    transports: [
      new transports.Console({
        level: 'info',
        format: combine(
          winston.format.colorize(),
          consoleFormat)
      }),
      logFileTransport
    ],
    format: combine(timestamp(), fileFormat)
  });

  function closeMe() {
    logFileTransport.close(process.exit);
  }

  process.on('SIGINT', function() {
    closeMe();
  });

  process.on('SIGTERM', function() {
    closeMe();
  });
  module.exports.log = log;
  return log;
}

module.exports = {
  /**
   * winston logger for access requests
   */
  log,
  setupLogging
};
