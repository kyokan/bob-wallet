import { RECORD_TYPE } from '../ducks/names';

var ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
var ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

export const isV4Format = ip => ipv4Regex.test(ip);
export const isV6Format = ip => ipv6Regex.test(ip);

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
    default:
      break;
  }

  if (isNaN(Number(ttl))) {
    errorMessage = 'TTL must be number';
  }

  return errorMessage;
};
