// Based on:
// - https://github.com/Falci/well-known-wallets-hns/blob/master/lib.js
// - https://github.com/lukeburns/hip2-dane/blob/main/index.js

import isValidAddress from '../../utils/verifyAddress';

const hdns = require('hdns');
const https = require('https');

const MAX_LENGTH = 90;

const verifyTLSA = async (cert, host) => {
  try {
    const tlsa = await hdns.resolveTLSA(host, 'tcp', 443);
    const valid = hdns.verifyTLSA(tlsa[0], cert.raw);

    return valid;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export async function getAddress(host, network) {
  let certificate = undefined;

  return new Promise(async (resolve, reject) => {
    const options = {
      rejectUnauthorized: false,
      lookup: hdns.legacy,
    };

    const req = https.get(`https://${host}/.well-known/wallets/HNS`, options, res => {
      res.setEncoding('utf8');

      let data = '';

      res.on('data', chunk => {
        // undefined = not yet stored
        // null = socket destroyed
        // object = may contain certificate
        if (certificate === undefined) {
          certificate = res.socket.getPeerCertificate(false);
        }

        const newLine = chunk.indexOf('\n');
        if (newLine >= 0) {
          req.destroy();
          chunk = chunk.slice(0, newLine);
        }

        if (data.length + chunk.length > MAX_LENGTH) {
          if (!req.destroyed) {
            req.destroy();
          }
          const error = new Error('response too large');
          error.code = 'ELARGE';
          return reject(error);
        }

        data += chunk;
      })

      res.on('end', async () => {
        const dane = await verifyTLSA(certificate, host);
        if (!dane) {
          const error = new Error('invalid DANE');
          error.code = 'EINSECURE';
          return reject(error);
        }

        if (res.statusCode >= 400) {
          const error = new Error(res.statusMessage);
          error.code = res.statusCode;
          return reject(error);
        }

        const addr = data.trim();

        if (!isValidAddress(addr, network)) {
          const error = new Error('invalid address');
          error.code = 'EINVALID';
          return reject(error);
        }

        return resolve(data.trim());
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export const { setServers } = hdns;
