import mixpanel from 'mixpanel';
import uuid from 'uuid';
import { del, get, put } from '../db/service';
import * as os from 'os';
import isDev from '../../utils/isDev';

const pkg = require('../../../package.json');
const electron = require('electron');

const MIXPANEL_TOKEN = '03bfcccfa5463ac6017761207e8cb0e3';
const USER_ID_KEY = 'analytics:userId';
const OPT_IN_STATE_KEY = 'analytics:optIn';

let mp;
let userId;

export async function setOptIn(state) {
  if (!state) {
    await put(OPT_IN_STATE_KEY, '0');
    await del(USER_ID_KEY);
    return;
  }

  const u = uuid.v4();
  await put(USER_ID_KEY, u);
  await put(OPT_IN_STATE_KEY, '1');
  userId = u;
  mp = mixpanel.init(MIXPANEL_TOKEN);
  mp.people.set(u, {
    $name: u,
    platform: os.platform(),
    arch: os.arch(),
    appVersion: pkg.version,
    isDev: isDev(),
  });
}

export async function getOptIn() {
  const state = await get(OPT_IN_STATE_KEY);
  if (state === '1') {
    return 'OPTED_IN';
  }
  if (state === '0') {
    return 'OPTED_OUT';
  }
  return 'NOT_CHOSEN';
}

export async function startTracking() {
  const u = await get(USER_ID_KEY);
  if (!u) {
    return;
  }

  userId = u;
  mp = mixpanel.init(MIXPANEL_TOKEN);
  mp.people.set(u, {
    platform: os.platform(),
    arch: os.arch(),
    appVersion: pkg.version,
  });
}

export async function track(name, data) {
  if (!mp) {
    return;
  }

  mp.track(
    name,
    {
      ...data,
      distinct_id: userId,
    },
  );
}

export async function screenView(name, opts) {
  await track(
    'viewed page',
    {
      name,
      ...opts,
    },
  );
}

const sName = 'Analytics';
const methods = {
  setOptIn,
  getOptIn,
  track,
  screenView,
};

export async function start(server) {
  await startTracking();
  server.withService(sName, methods);
}
