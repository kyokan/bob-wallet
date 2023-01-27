# Internationalization (i18n)

This documents describes how i18n works in Bob Wallet, and how to add support for a new language

## Overview

All locale strings are saved as `{locale}.json` based on result return from [electron.app.getLocale()](https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc).

A locale json looks like this:

en.json
```json
{
  "hello": "Hello, %s!"
}
```

On app starts, all locale strings are compiled into a JSON object, and injected to the app using [React Context](https://reactjs.org/docs/context.html).

Usage Example:
```js
import {I18nContext} from "../../utils/i18n";

class Example extends Component { 
    static contextType = I18nContext;

    render() {
        const {t} = this.context;
        
        // This will render "Hello, World!" based on en.json above
        return (
            <div>{t('hello', 'World')}</div>
        );     
    } 
}
```


When getting string using the injected `this.context.t(localeKey)` function, the app will:
- first check to see if there is a matching string for `localeKey` from the exact locale (e.g. `en-US.json`)
- if a matching string cannot be found, it will check to see if there is matching string for `localeKey` from the root locale (e.g. `en-US.json` -> `en.json`)
- if a match is still not found, it will use `en.json` by default
- if `localeKey` is not found in `en.json`, it will render `this.context.t(localeKey)` in the UI;


## Adding Support for New Language

1. Copy `/locales/en.json` to a new file, and save it as `[locale].json`. For example, if you are adding support for Spanish, the file name should be `es.json`. You can find all valid locale strings [here](https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc).
2. Start translating 📙
3. When finished translating, save your file
4. Go to https://github.com/kyokan/bob-wallet/tree/master/locales
5. Click `Add Files -> Uplaod Files`
6. Drag and drop your file to upload it to GitHub
7. Make sure you select **Create a new branch for this commit and start a pull request.**
8. Click **Propose Change**

## Adding New Keys to Existing JSON

As new copies are added to Bob Wallet, new keys will be added to `en.json`. There is a npm script added to help extend new key to existing locale json. 

The following script will extend `zh.json` with any new keys from `en.json` without overwritting existing translations.
```bash
npm run add-locale zh
```

## Testing New Translation
1. Go to Setting -> General
2. From the language dropdown, select Custom JSON
3. Upload your translation json file

## Note to Maintainers

- When merging in a new locale json, be sure to update the dropdown list in `app/util/i18n.js` with the new locale.
- When new keys are added to `en.json`, make sure to run `npm run add-locale` to extend new keys to existing locale json.

## Languages

| Language | Filename   | Contributors                      |
|----------|------------|-----------------------------------|
| Catalan  | ca.json    | Faltrum (@faltrum)                |
| Spanish  | es-ES.json | Faltrum (@faltrum)                |
| French   | fr-FR.json | Miguel Gargallo (@miguelgargallo) |
| Russian  | ru-RU.json | Igor Abramov (@IgorAbramov)       |
