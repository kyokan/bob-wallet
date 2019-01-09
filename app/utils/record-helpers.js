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
    default:
      break;
  }

  if (isNaN(Number(ttl))) {
    errorMessage = 'TTL must be number';
  }

  return errorMessage;
};
