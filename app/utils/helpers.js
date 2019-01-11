export function filterOne(array, filterFn) {
  let hasFiltered = false;
  return array.filter(d => {
    if (hasFiltered) {
      return true;
    }

    const ret = filterFn(d);

    if (!ret) {
      hasFiltered = true;
    }

    return ret;
  })
}

export function deepEqual(x, y) {
  if (typeof x !== typeof y) {
    return false;
  }

  if (Array.isArray(x)) {
    if (x.length !== y.length) {
      return false;
    }

    for (let i = 0; i < x.length; i++) {
      if (!deepEqual(x[i], y[i])) {
        return false;
      }
    }

    return true;
  }

  if (typeof x === 'object' && x !== null && typeof x !== 'undefined') {
    if (Object.keys(x).length !== Object.keys(y).length) {
      return false;
    }

    for (const key in x) {
      if (y.hasOwnProperty(key)) {
        if (!deepEqual(x[key], y[key])) {
          return false;
        }
      }
    }

    return true;
  }

  return x === y;
}
