import { app } from 'electron';
import pify from '../utils/pify';
import gunzip from 'gunzip-maybe';
import tar from 'tar-fs';
import { execFile, spawn } from 'child_process';
import isDev from '../utils/isDev';

const path = require('path');
const fs = require('fs');

export async function installBinDep(name, platform, arch) {
  const bindep = `${name}-${platform}-${arch}.tgz`;
  let tarballPath;

  if (isDev()) {
    tarballPath = path.join(__dirname, '..', 'bindeps', bindep);
  } else {
    tarballPath = path.join(app.getAppPath(), 'app', 'bindeps', bindep);
  }

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`bindep ${bindep} does not exist. tried path: ${tarballPath}`);
  }

  const udPath = app.getPath('userData');
  const binPath = path.join(udPath, name);

  if (fs.existsSync(binPath)) {
    return;
  }
  await pify((cb) => fs.mkdir(binPath, {recursive: true}, cb));

  const stream = fs.createReadStream(tarballPath);
  return new Promise((resolve, reject) => stream.pipe(gunzip()).pipe(tar.extract(udPath))
    .on('error', reject)
    .on('finish', resolve));
}

export async function executeBinDep(mode, name, internalBinPath, args) {
  const udPath = app.getPath('userData');
  const binPath = path.join(udPath, name, internalBinPath);

  if (mode === 'execFile') {
    return execFile(binPath, args);
  }

  if (isDev()) {
    // this will use the local system's node interpreter,
    // which is helpful in dev.
    return spawn(binPath, args);
  }

  return spawn(process.execPath, [binPath, ...args], {
    env: {
      ELECTRON_RUN_AS_NODE: 1,
      // below env var is used to tell bcrypto to use JS
      // crypto implementations until we solve the native
      // build problems.
      NODE_BACKEND: 'js'
    }
  });
}
