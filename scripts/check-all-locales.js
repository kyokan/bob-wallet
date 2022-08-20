const fs = require('fs');
const path = require('path');

const PRIMARY_LOCALE_NAME = process.argv[2] || 'en';

/**
 * Checks difference between primary and other locale files
 * Call as `node ./scripts/check-all-locales.js [primary]
 * Primary defaults to `en`
 */
(async function () {
  console.log('[*] Primary Locale:', PRIMARY_LOCALE_NAME);
  const primaryLocale = require(`../locales/${PRIMARY_LOCALE_NAME}.json`);
  const primaryLocaleKeys = Object.keys(primaryLocale).sort()

  // All files in locales dir
  const locales = fs.readdirSync(path.join(__dirname, '..', 'locales'))

  for (const localeFilename of locales) {

    // Skip primary
    if (localeFilename === `${PRIMARY_LOCALE_NAME}.json`) continue;
    if (localeFilename === `zh.json`) continue; // Skip ZH for now as it's not maintained
    if (!localeFilename.endsWith('.json')) continue;

    console.log(`\n\n[*] === Locale: ${localeFilename} ===`);

    // Read file
    const locale = require(`../locales/${localeFilename.slice(0, -5)}.json`);
    const localeKeys = Object.keys(locale).sort()

    // Strings in primary, but not in this locale
    console.log(`\nStrings missing from ${localeFilename} (to be added):`);
    console.log(
      primaryLocaleKeys
        .filter(k => !locale[k])
        .map(k => `  "${k}": "TRANSLATE ME: < ${primaryLocale[k].replace(/[\\"]/g, '\\$&')} >",`)
        .join('\n')
    );

    // Strings in this locale, but not in primary
    console.log(`\nStrings not needed in ${localeFilename} (to be removed):`);
    console.log(localeKeys.filter(k => !primaryLocale[k]).map(k => `  ${k}`).join('\n'));

    // Strings that match primary (either not translated, or it makes sense to use the same terms)
    console.log(`\nStrings in ${localeFilename} matching primary locale (verify):`);
    console.log(localeKeys.filter(k => primaryLocale[k] === locale[k]).map(k => `  ${k} (${locale[k]})`).join('\n'));
  }

  console.log('\nDone!');
})();
