import punycode from 'punycode/';
import {verifyName} from 'hsd/lib/covenants/rules';

// Display policy, not an IDNA or ownership validator. Keep the canonical ASCII
// identity alongside Unicode and never use the display result in wallet actions.
export function displayName(name) {
  if (typeof name !== 'string' || !name.startsWith('xn--') || !verifyName(name)) return name;
  try {
    const unicode = punycode.toUnicode(name);
    const visible = unicode.replace(/[\uFE0E\uFE0F]/g, '');
    if (unicode === name || punycode.toASCII(unicode) !== name ||
        unicode.normalize('NFC') !== unicode ||
        !/[^\x00-\x7f]/.test(unicode) ||
        /[\p{C}\p{Z}]/u.test(unicode) ||
        /\p{Default_Ignorable_Code_Point}/u.test(visible) ||
        /^\p{M}/u.test(unicode) ||
        /[^\p{L}\p{N}\p{M}\p{S}_-]/u.test(unicode)) return name;
    return unicode;
  } catch (error) {
    return name;
  }
}
