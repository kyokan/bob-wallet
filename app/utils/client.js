class Client {
  constructor() {
    this.port = chrome.extension.connect({ name: global.location.href });
    this.id = 0;
    this.defers = {};
    this.port.onMessage.addListener(msg => {
      // eslint-disable-next-line no-use-before-define
      const { id, payload, error } = parseAction(msg);
      const { resolve, reject } = this.defers[id] || {};

      if (error && reject) {
        reject(payload);
        this.defers[id] = null;
        return;
      }

      if (resolve) {
        resolve(payload);
        this.defers[id] = null;
      }
    });
  }

  dispatch(action) {
    const data = {
      ...action,
      id: this.id
    };

    const promise = new Promise((resolve, reject) => {
      this.defers[this.id] = { resolve, reject };
    });

    this.port.postMessage(JSON.stringify(data));
    // eslint-disable-next-line no-plusplus
    this.id++;
    return promise;
  }
}

export default new Client();

function parseAction(msg) {
  try {
    return JSON.parse(msg);
  } catch (err) {
    return {};
  }
}
