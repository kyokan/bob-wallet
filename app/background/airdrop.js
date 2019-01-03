import { defaultServer, makeClient } from './ipc';
import { spawn } from 'child_process';
import readline from 'readline';

export async function proveFaucet(keyFile, keyId, addr, fee, passphrase) {
  const isPGP = keyFile.indexOf('.asc') > -1 || keyFile.indexOf('.gpg') > -1 || keyFile.indexOf('.pgp') > -1;
  if (isPGP && !keyId) {
    throw new Error('keyId is required for PGP keys.');
  }

  const args = [
    keyFile,
    addr,
    fee
  ];

  if (keyId) {
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
  const airdrop = spawn('./node_modules/hs-airdrop/bin/hs-airdrop', args);
  let errData = [];
  airdrop.stdin.write(`${passphrase}\n`);
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
