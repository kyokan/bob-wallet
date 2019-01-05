import { defaultServer, makeClient } from './ipc';
import readline from 'readline';
import { executeBinDep, installBinDep } from './bindeps';

const path = require('path');

export async function proveFaucet(keyFile, keyId, addr, fee, passphrase) {
  const isPGP = keyFile.indexOf('.asc') > -1 || keyFile.indexOf('.gpg') > -1 || keyFile.indexOf('.pgp') > -1;
  if (isPGP && !keyId) {
    throw new Error('keyId is required for PGP keys.');
  }

  // IMPORTANT: all input to this function must be checked to prevent
  // shell command injection.
  //
  // NOTE: passphrase is sent to stdin, so is safe.

  if (!fs.existsSync(keyFile)) {
    throw new Error('keyFile does not exist.')
  }

  if (!addr.match(/[a-z0-9]{42}/i)) {
    throw new Error('invalid address.')
  }

  if (isNaN(Number(fee))) {
    throw new Error('invalid fee.');
  }

  const args = [
    keyFile,
    addr,
    fee
  ];

  if (keyId) {
    if (!keyId.match(/[A-F0-9]+/i)) {
      throw new Error('Invalid key id.');
    }

    args.splice(1, 0, keyId);
  }

  return executeProver(args, passphrase);
}
proveFaucet.sanitizedArgs = [4];

export function proveAirdrop(addr, value, isSponsor) {
  const args = [
    addr,
    value
  ];

  if (isSponsor) {
    args.push('--sponsor');
  }

  return executeProver(args);
}

async function executeProver(args, passphrase = '') {
  await installBinDep('hs-airdrop', 'darwin', 'x86_64');
  const airdrop = await executeBinDep('spawn', 'hs-airdrop', path.join('bin', 'hs-airdrop'), args);
  let errData = [];
  airdrop.stdout.on('data', (d) => console.log('out', d.toString('utf-8')));
  airdrop.stdin.setEncoding('utf-8');
  airdrop.stdin.write(`${passphrase}\n`);
  airdrop.stdin.end();
  airdrop.stderr.on('data', (d) => errData.push(d.toString('utf-8')));

  let lastLine;
  const rl = readline.createInterface({
    input: airdrop.stdout,
    output: airdrop.stdin
  });
  rl.on('line', (line) => {
    lastLine = line;
  });

  return new Promise((resolve, reject) => {
    airdrop.on('exit', (code) => {
      rl.close();

      if (code !== 0) {
        return reject(new Error(errData.join('\n')));
      }

      resolve(lastLine);
    });
  })
}

const sName = 'Airdrop';
const methods = {
  proveFaucet,
  proveAirdrop
};

export const clientStub = (ipcRendererInjector) => makeClient(ipcRendererInjector, sName, Object.keys(methods));
defaultServer.withService(sName, methods);
