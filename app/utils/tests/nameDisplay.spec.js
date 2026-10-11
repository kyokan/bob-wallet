import test from 'tape';
import punycode from 'punycode/';
import {displayName} from '../nameDisplay';
import {formatName} from '../nameHelpers';
import {displayName as shakeXDisplay} from '../../addons/shakex/displayName';

test('marketplace display preserves canonical identities and safe emoji, rejecting hidden variants', t => {
  for (const [ascii, decoded] of [['xn--158h', '\u{1f680}'], ['xn--sr8h', '\u{1f48d}'],
    ['xn--k77hya', '\u{1f1ec}\u{1f1f8}'], ['xn--fiq228c', '\u4e2d\u6587']]) {
    t.equal(displayName(ascii), decoded);
    t.equal(formatName(ascii), `${ascii}/ (${decoded})`);
    t.equal(shakeXDisplay(ascii), decoded, 'same policy across marketplaces');
  }
  for (const ascii of ['xn--1ug6046p', 'xn--1ug9365p', 'xn--', 'xn--abc-', 'xn--a', 'XN--158H',
    ...['a\u202eb', 'a\u200bb', 'e\u0301', '\u0301a', 'a\u0000b'].map(punycode.toASCII)]) {
    t.equal(displayName(ascii), ascii);
    t.equal(formatName(ascii), `${ascii}/`, 'unsafe Unicode never displayed or normalized into a different name');
  }
  t.end();
});
