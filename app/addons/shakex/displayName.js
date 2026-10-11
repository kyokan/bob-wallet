import {displayName} from '../../utils/nameDisplay';

export {displayName};

export function matchesName(name, query) {
  const search = query.trim().toLowerCase();
  return name.includes(search) || displayName(name).toLowerCase().includes(search);
}
