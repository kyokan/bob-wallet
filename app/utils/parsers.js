import { MTX } from 'hsd/lib/primitives/mtx';

/**
 * Parse Transaction File
 * @param {string} data json string read from file
 * @returns {object} obj
 * @returns {MTX} obj.mtx MTX instance
 * @returns {string} obj.txHex tx hex string
 * @returns {object} obj.metadata metadata
 */
export function parseTxFile(data) {
  const json = JSON.parse(data);

  if (json.version !== 1)
    throw new Error('Incompatible version.');

  if (!json.tx || typeof json.tx !== 'string')
    throw new Error('No transaction found in file.');

  const mtx = MTX.decode(Buffer.from(json.tx, 'hex'));
  // const tx = MTX.fromJSON(json.tx);

  if (json.metadata && typeof json.metadata !== 'object')
    throw new Error('Invalid metadata.');

  return {
    mtx,
    txHex: json.tx,
    metadata: json.metadata,
  };
}
