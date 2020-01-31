import { RECORD_TYPE } from '../ducks/names';

const ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
const ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

export const isV4Format = ip => ipv4Regex.test(ip);
export const isV6Format = ip => ipv6Regex.test(ip) && !ipv4Regex.test(ip);
export const isHex = str => {
  if (typeof str !== 'string') {
    return false;
  }

  if (str.length & 1)
    return false;

  return /^[A-Fa-f0-9]+$/.test(str);
};

export const validate = (record) => {
  let errorMessage = '';

  switch (record.type) {
    case RECORD_TYPE.NS:
      if (!record.ns) {
        errorMessage = 'Record type NS must not be empty';
      }
      break;
    case RECORD_TYPE.TXT:
      if (!record.txt[0]) {
        errorMessage = 'Record type TXT cannot be empty';
      }
      break;
    case RECORD_TYPE.DS:
      if ((record.keyTag & 0xffff) !== record.keyTag) {
        errorMessage = 'keyTag must be a natural number between 0 - 65535';
        break;
      }

      if ((record.algorithm & 0xff) !== record.algorithm) {
        errorMessage = 'algorithm must be a natural number between 0 - 255';
        break;
      }

      if ((record.digestType & 0xff) !== record.digestType) {
        errorMessage = 'digestType must be a natural number between 0 - 255';
        break;
      }

      if (record.digest.length >>> 1 > 255) {
        errorMessage = 'digest is too long';
        break;
      }

      if (!isHex(record.digest)) {
        errorMessage = 'digest must be a hex string';
      }
      break;
    case RECORD_TYPE.GLUE4:
      if (typeof record.ns !== 'string') {
        errorMessage = 'ns must be a string';
        break;
      }

      if (record.ns === '') {
        errorMessage = 'must define an ns';
        break;
      }

      if (!isV4Format(record.address)) {
        errorMessage = 'address must be a V4 IP';
      }
      break;
    case RECORD_TYPE.GLUE6:
      if (typeof record.ns !== 'string') {
        errorMessage = 'ns must be a string';
        break;
      }

      if (!record.ns) {
        errorMessage = 'must define an ns';
        break;
      }

      if (!isV6Format(record.address)) {
        errorMessage = 'address must be a V6 IP';
      }
      break;
    case RECORD_TYPE.SYNTH4:
      if (!isV4Format(record.address)) {
        errorMessage = 'address must be a v4 IP';
      }
      break;
    case RECORD_TYPE.SYNTH6:
      if (!isV6Format(record.address)) {
        errorMessage = 'address must be a V6 IP';
      }
      break;
    default:
      break;
  }

  return errorMessage;
};

const serializers = {
  [RECORD_TYPE.TXT]: record => record.txt[0],
  [RECORD_TYPE.NS]: record => record.ns,
  [RECORD_TYPE.DS]: record => `${record.keyTag} ${record.algorithm} ${record.digestType} ${record.digest}`,
  [RECORD_TYPE.GLUE4]: record => `${record.ns} ${record.address}`,
  [RECORD_TYPE.GLUE6]: record => `${record.ns} ${record.address}`,
  [RECORD_TYPE.SYNTH4]: record => record.address,
  [RECORD_TYPE.SYNTH6]: record => record.address,
};

const deserializers = {
  [RECORD_TYPE.TXT]: (value) => ({
    type: RECORD_TYPE.TXT,
    txt: [value],
  }),
  [RECORD_TYPE.NS]: (value) => ({
    type: RECORD_TYPE.NS,
    ns: value,
  }),
  [RECORD_TYPE.DS]: (value) => {
    const parts = value.trim().split(' ');
    if (parts.length !== 4) {
      throw new Error('DS records must be formatted as keyTag algorithm digestType digest');
    }

    return {
      type: RECORD_TYPE.DS,
      keyTag: Number(parts[0]),
      algorithm: Number(parts[1]),
      digestType: Number(parts[2]),
      digest: parts[3],
    };
  },
  [RECORD_TYPE.GLUE4]: (value) => {
    const parts = value.trim().split(' ');
    if (parts.length !== 2) {
      throw new Error('GLUE4 records must be formatted as ns address');
    }

    return {
      type: RECORD_TYPE.GLUE4,
      ns: parts[0],
      address: parts[1],
    };
  },
  [RECORD_TYPE.GLUE6]: (value) => {
    const parts = value.trim().split(' ');
    if (parts.length !== 2) {
      throw new Error('GLUE6 records must be formatted as ns address');
    }

    return {
      type: RECORD_TYPE.GLUE4,
      ns: parts[0],
      address: parts[1],
    };
  },
  [RECORD_TYPE.SYNTH4]: (value) => ({
    type: RECORD_TYPE.SYNTH4,
    address: value,
  }),
  [RECORD_TYPE.SYNTH6]: (value) => ({
    type: RECORD_TYPE.SYNTH6,
    address: value,
  }),
};

export function deserializeRecord({type, value}) {
  const deserializer = deserializers[type];
  if (!deserializer) {
    throw new Error('Invalid record type.');
  }

  return deserializer(value);
}

export function serializeRecord(record) {
  const serializer = serializers[record.type];
  if (!serializer) {
    throw new Error('Invalid record type.');
  }

  return serializer(record);
}
