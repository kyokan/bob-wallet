import { RECORD_TYPE } from '../ducks/names';
import Resource from '../../node_modules/hsd/lib/dns/resource'

var ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
var ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

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

export const validate = ({ type, value, ttl }) => {
  let errorMessage = '';

  if (!RECORD_TYPE[type]) {
    errorMessage = 'Invalid record type';
  }

  switch (type) {
    case RECORD_TYPE.A:
      if (!isV4Format(value)) {
        errorMessage = 'Record type A must be IPv4';
      }
      break;
    case RECORD_TYPE.AAAA:
      if (!isV6Format(value) || isV4Format(value)) {
        errorMessage = 'Record type A must be IPv6';
      }
      break;
    case RECORD_TYPE.CNAME:
      if (!value) {
        errorMessage = 'Record type CNAME must not be empty';
      }

      if (isV6Format(value)) {
        errorMessage = 'Record type CNAME cannot be INET';
      }
      break;
    case RECORD_TYPE.NS:
      if (!value) {
        errorMessage = 'Record type NS must not be empty';
      }

      if (isV6Format(value)) {
        errorMessage = 'Record type NS cannot be INET';
      }
      break;
    case RECORD_TYPE.TXT:
      if (!value) {
        errorMessage = 'Record type TXT cannot be empty';
      }
      break;
    case RECORD_TYPE.DS:
      try {
        const json = JSON.parse(value);

        if ((json.keyTag & 0xffff) !== json.keyTag) {
          errorMessage = 'keyTag must be a natural number between 0 - 65535';
        }

        if ((json.algorithm & 0xff) !== json.algorithm) {
          errorMessage = 'algorithm must be a natural number between 0 - 255';
        }

        if ((json.digestType & 0xff) !== json.digestType) {
          errorMessage = 'digestType must be a natural number between 0 - 255';
        }

        if (typeof json.digest !== 'string') {
          errorMessage = 'digest must be a hex string';
        }

        if (json.digest.length >>> 1 > 255) {
          errorMessage = 'digest is too long';
        }

      } catch (e) {
        errorMessage = 'Expect json string with following keys: "keyTag", "algorithm", "digestType", "digest"';
      }
      break;
    case RECORD_TYPE.MX:
      if (typeof value !== 'string') {
        errorMessage = 'Expect string in the format of "[Priority] [Target]" (e.g. 10 mail.example.com.)';
      }

      const [ priority, target ] = value.split(' ');

      if (!priority || !target) {
        errorMessage = 'Expect string in the format of "[Priority] [Target]" (e.g. 10 mail.example.com.)';
      } else if ((Number(priority) & 0xff) !== Number(priority)) {
        errorMessage = 'priority must be a natural number between 0 - 255';
      } else if (target.charCodeAt(target.length - 1) !== 0x2e) {
        errorMessage = 'target should have trailing period';
      }

      break;
    case RECORD_TYPE.OPENPGPKEY:
      try {
        const json = JSON.parse(value);

        if (!isHex(json.hash)) {
          errorMessage = 'hash is not a valid hex string';
        }

        if (!isHex(json.publicKey)) {
          errorMessage = 'publicKey is not a valid hex string';
        }

      } catch (e) {
        errorMessage = 'Expect json string with following keys: "hash", "publicKey"';
      }
      break;
    case RECORD_TYPE.SRV:
      try {
        const json = JSON.parse(value);

        if (typeof json.protocol !== 'string') {
          errorMessage = 'protocol should not be empty';
        }

        if (typeof json.service !== 'string') {
          errorMessage = 'service should not be empty';
        }

        if (json.priority != null) {
          if ((json.priority & 0xff) !== json.priority) {
            errorMessage = 'priority must be a natural number between 0 - 255';
          }
        }

        if (json.weight != null) {
          if ((json.weight & 0xff) !== json.weight) {
            errorMessage = 'weight must be a natural number between 0 - 255';
          }
        }

        if (json.port != null) {
          if ((json.port & 0xffff) !== json.port) {
            errorMessage = 'port must be a natural number between 0 - 65535';
          }
        }
      } catch (e) {
        errorMessage = 'Expect json string with following keys: "protocol", "service", "weight", "target", "port", "priority"';
      }
    default:
      break;
  }

  if (isNaN(Number(ttl))) {
    errorMessage = 'TTL must be number';
  }

  return errorMessage;
};

const serializers = {
  [RECORD_TYPE.A]: json => maybeArray(json.hosts)
    .filter(isV4Format)
    .map(ip => makeRecord(RECORD_TYPE.A, ip)),
  [RECORD_TYPE.AAAA]: json => maybeArray(json.hosts)
    .filter(isV6Format)
    .map(ip => makeRecord(RECORD_TYPE.AAAA, ip)),
  [RECORD_TYPE.TXT]: json => maybeArray(json.text)
    .map(text => makeRecord(RECORD_TYPE.TXT, text)),
  [RECORD_TYPE.NS]: json => maybeArray(json.ns)
    .map(ns => makeRecord(RECORD_TYPE.NS, ns)),
  [RECORD_TYPE.DS]: json => maybeArray(json.ds)
    .map(ds => makeRecord(RECORD_TYPE.DS, JSON.stringify(ds))),
  [RECORD_TYPE.MX]: json => maybeArray(json.service)
    .filter(({ protocol, service }) => protocol === 'tcp' && service === 'smtp')
    .map(({ priority, target }) => makeRecord(RECORD_TYPE.MX, `${priority} ${target}`)),
  [RECORD_TYPE.CNAME]: json => json.canonical ? [makeRecord(RECORD_TYPE.CNAME, json.canonical)] : [],
  [RECORD_TYPE.OPENPGPKEY]: json => maybeArray(json.pgp)
    .map(pgp => makeRecord(RECORD_TYPE.OPENPGPKEY, JSON.stringify(pgp))),
  [RECORD_TYPE.SRV]: json => maybeArray(json.service)
    .filter(({ protocol, service }) => protocol !== 'tcp' || service !== 'smtp')
    .map(srv => makeRecord(RECORD_TYPE.SRV, JSON.stringify(srv))),
};

const deserializers = {
  [RECORD_TYPE.A]: (acc, value) => {
    acc.hosts = maybeArray(acc.hosts);
    acc.hosts.push(value);
  },
  [RECORD_TYPE.AAAA]: (acc, value) => {
    acc.hosts = maybeArray(acc.hosts);
    acc.hosts.push(value);
  },
  [RECORD_TYPE.TXT]: (acc, value) => {
    acc.text = maybeArray(acc.text);
    acc.text.push(value);
  },
  [RECORD_TYPE.NS]: (acc, value) => {
    acc.ns = maybeArray(acc.ns);
    acc.ns.push(value);
  },
  [RECORD_TYPE.DS]: (acc, value) => {
    try {
      const { keyTag, digest, digestType, algorithm } = JSON.parse(value);
      acc.ds = maybeArray(acc.ds);
      acc.ds.push({ keyTag, digest, digestType, algorithm });
    } catch (e) {
      console.error(e);
    }
  },
  [RECORD_TYPE.CNAME]: (acc, value) => {
    acc.canonical = value
  },
  [RECORD_TYPE.MX]: (acc, value) => {
    const [ priority, target ] = value.split(' ');
    acc.service = maybeArray(acc.service);
    acc.service.push({
      priority: Number(priority),
      target,
      protocol: 'tcp',
      service: 'smtp',
    })
  },
  [RECORD_TYPE.OPENPGPKEY]: (acc, value) => {
    try {
      const { hash, publicKey } = JSON.parse(value);
      acc.pgp = maybeArray(acc.pgp);
      acc.pgp.push({ hash, publicKey });
    } catch (e) {
      console.error(e);
    }
  },
  [RECORD_TYPE.SRV]: (acc, value) => {
    try {
      const {
        protocol,
        service,
        weight,
        target,
        port,
        priority,
      } = JSON.parse(value);
      acc.service = maybeArray(acc.service);
      acc.service.push({
        protocol,
        service,
        weight,
        target,
        port,
        priority,
      });
    } catch (e) {
      console.error(e);
    }
  }
};

export const serializeResource = resource => {
  if (!resource || !resource.getJSON) {
    return [];
  }

  let ret = [];
  const json = resource.getJSON();

  Object.entries(serializers)
    .forEach(([ type, serialize ]) => {
      ret = ret.concat(serialize(json))
    });

  return ret;
};

export const deserializeResource = (records, ttl) => {
  if (!Array.isArray(records)) {
    console.error('Expect args[0] to be an array of records');
    return;
  }

  const json = {};

  records.forEach(({ type, value }) => {
    const deserialize = maybeFunc(deserializers[type]);
    deserialize(json, value);
  });

  if (ttl != null && ttl) {
    json.ttl = Number(ttl);
  }

  return Resource.fromJSON(json);
};

function maybeArray(val) {
  return Array.isArray(val) ? val : [];
}

function maybeFunc(fn) {
  return typeof fn === 'function' ? fn : function() {}
}

function makeRecord(type, value) {
  return { type, value };
}
