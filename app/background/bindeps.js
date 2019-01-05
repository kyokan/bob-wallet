import { app } from 'electron';
import pify from '../utils/pify';
import gunzip from 'gunzip-maybe';
import tar from 'tar-fs';
import { execFile, spawn } from 'child_process';

const path = require('path');
const fs = require('fs');

export async function installBinDep(name, platform, arch) {
  const bindep = `${name}-${platform}-${arch}.tgz`;
  const tarballPath = path.join(__dirname, '..', 'bindeps', bindep);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`bindep ${bindep} does not exist`);
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

  return spawn(binPath, args);
}
