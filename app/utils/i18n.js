import React from "react";
const r = require.context('../../locales/', true, /\.json$/);
const keys = r.keys();
const localeStrings = keys.map(k => k.replace('./', '').replace('.json', ''));
const jsons = keys.map(r);
const translations = keys.reduce((acc, key, i) => {
  acc[localeStrings[i]] = jsons[i];
  return acc;
}, {});

export const I18nContext = React.createContext({
  t: function() {},
});

export default translations;

export const languageDropdownItems = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'French (FR)', value: 'fr-FR' },
  { label: 'Español (ES)', value: 'es-ES' },
  { label: 'Català (CAT)', value: 'ca' },
  { label: 'Russian (RU)', value: 'ru' },
  // { label: '中文', value: 'zh' },
  { label: 'Custom JSON', value: 'custom' },
];
