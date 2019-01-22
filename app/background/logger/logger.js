import winston from 'winston';
import { app } from 'electron';

require('winston-daily-rotate-file');

const path = require('path');

// Set up logger format
const { combine, timestamp, printf } = winston.format;

const loggerFormat = printf(info => {
  let { timestamp, level, message } = info;

  if (typeof info.message === 'object') {
    message = JSON.stringify(message);
  }

  return `${timestamp} [${level}] - ${message}`;
});

// Declare local variables
let logger;
let queue = [];

export async function warn(message) {
  if (!logger) {
    queue.push(() => warn(message));
  } else {
    logger.warn(message);
  }
}

export async function error(message) {
  if (!logger) {
    queue.push(() => error(message));
  } else {
    logger.error(message);
  }
}

export async function info(message) {
  if (!logger) {
    queue.push(() => info(message));
  } else {
    logger.info(message);
  }
}

export async function log() {
  if (!logger) {
    queue.push(() => log(...arguments));
  } else {
    logger.log(...arguments);
  }
}

export function startLogger() {
  const udPath = app.getPath('userData');
  const outputDir = path.join(udPath, 'hsd_output');

  const transport = new (winston.transports.DailyRotateFile)({
    filename: `${outputDir}/bob-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  });

  logger = winston.createLogger({
    format: combine(
      timestamp(),
      loggerFormat,
    ),
    transports: [
      transport,
    ]
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console());
  }

  queue.forEach(fn => fn());
  queue = [];
}
