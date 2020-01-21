import * as protocol from 'hsd/lib/protocol';

const isValidAddress = (address, network) => {
  const {networks} = protocol;
  const inputAddressPrefix = address.slice(0, 2);
  const expectedAddressPrefix = networks[network].addressPrefix;
  return (inputAddressPrefix === expectedAddressPrefix);
};

export default isValidAddress;
