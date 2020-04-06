import winston from 'winston';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// Set up logger format
const {combine, timestamp, printf, colorize} = winston.format;

const loggerFormat = printf(info => {
  let {timestamp, level, message} = info;

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

export async function download(network) {
  const udPath = app.getPath('userData');
  let outputDir = path.join(udPath, 'hsd_data');

  if (network !== 'main')
    outputDir = path.join(outputDir, network);

  const content = read(`${outputDir}/debug.log`);

  return content;
}

function read(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    return '\n';
  }
}

export function startLogger() {
  const udPath = app.getPath('userData');
  const outputDir = path.join(udPath, 'hsd_output');

  const transport = new (winston.transports.File)({
    filename: `${outputDir}/combined.log`,
    maxsize: '10000000',
    maxFiles: '0',
    tailable: true,
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

  // if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console());
  // }

  queue.forEach(fn => fn());
  queue = [];
}

const sName = 'Logger';
const methods = {
  info,
  warn,
  error,
  log,
  download,
};

export function start(server) {
  server.withService(sName, methods);
}
