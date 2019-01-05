export default function ellipsify(str, len=8) {
  if (len * 2 > str.length - 3) {
    return str;
  }

  return str.substr(0, len) + '...' + str.substr(str.length - len);
}
