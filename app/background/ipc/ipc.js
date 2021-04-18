const Sentry = require('@sentry/electron');

export const SIGIL = '@@RPC@@';

let lastId = 0;

export const nullServer = {
  withMethod() {
  },
  withService() {
  },
  start() {
  },
  stop() {
  },
};

function log() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.log(...arguments);
}

// used to scrub sensitive info from RPC calls
function sanitizeData(data, method) {
  if (method.suppressLogging) {
    const copy = JSON.parse(JSON.stringify(data));
    copy.params = ['<SANITIZED>'];
    return copy;
  }

  return data;
}

// used to scrub sensitive info from RPC responses
function sanitizeRes(res, method) {
  if (method.suppressLogging) {
    return '<SANITIZED>';
  }

  return res;
}

export function makeServer(ipcMain) {
  const methods = {};

  const handler = (event, data) => {
    const method = methods[data.method];

    if (!data.id) {
      log('IPC method call has no ID, aborting.');
      return event.sender.send(SIGIL, makeError(-32600, 'id not provided', null));
    }

    if (!method) {
      log(`IPC method ${data.method} does not exist, aborting.`);
      return event.sender.send(SIGIL, makeError(-32601, 'method not found', data.id));
    }

    let params;
    if (!Array.isArray(data.params)) {
      params = [data.params];
    } else {
      params = data.params;
    }

    const cb = (err, res) => {
      if (err) {
        log('Sending IPC method error.', sanitizeData(data, method), err);
        log('Stack:', err.stack);
        Sentry.captureException(err);
        return event.sender.send(SIGIL, makeError(err.code || -1, err.message, data.id));
      }
      log('Sending IPC method response.', sanitizeData(data, method), sanitizeRes(res, method));
      return event.sender.send(SIGIL, makeResponse(res, data.id));
    };

    log('Executing IPC method.', sanitizeData(data, method));
    const maybePromise = method.apply(null, [...params, cb]);
    if (maybePromise.then) {
      maybePromise.then((res) => cb(null, res))
        .catch((err) => cb(err));
    }
  };

  const server = {
    withMethod(service, name, method) {
      methods[`${service}.${name}`] = method;
    },
    withService(sName, methods) {
      Object.keys(methods).forEach((mName) => {
        server.withMethod(sName, mName, methods[mName]);
      });
    },
    start() {
      ipcMain.on(SIGIL, handler);
    },
    stop() {
      ipcMain.removeListener(SIGIL, handler);
    },
  };
  return server;
}

export function makeClient(ipcRendererInjector, sName, methods) {
  const mkSend = mName => (...params) => {
    const ipcRenderer = ipcRendererInjector();
    const id = ++lastId;

    log('Dispatching IPC method call.', id, mName);

    return new Promise((resolve, reject) => {
      const handler = (event, data) => {
        const jsonData = JSON.parse(data);
        if (jsonData.id !== id) {
          return;
        }

        ipcRenderer.off(SIGIL, handler);

        if (jsonData.error) {
          log('Received IPC error.', id, mName, jsonData.result);
          return reject(jsonData.error);
        }

        log('Received IPC response.', id, mName, jsonData.result);
        return resolve(jsonData.result);
      };

      ipcRenderer.send(SIGIL, {
        jsonrpc: '2.0',
        method: `${sName}.${mName}`,
        params,
        id,
      });
      ipcRenderer.on(SIGIL, handler);
    });
  };

  return methods.reduce((acc, curr) => {
    acc[curr] = mkSend(curr);
    return acc;
  }, {});
}

function makeResponse(result, id) {
  return JSON.stringify({
    jsonrpc: '2.0',
    result,
    id,
  });
}

function makeError(code, message, id) {
  return JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code,
      message,
    },
    id,
  });
}
