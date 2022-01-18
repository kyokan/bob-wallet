const EN = require("../locales/en.json");
const fs = require('fs');
const path = require('path');
const [nodeDir, scriptDir, locale] = process.argv;

(async function () {
  const targetPath = path.join(process.cwd(), 'locales', `${locale}.json`);
  let existingJson = {};
  try {
    const existing = await fs.promises.readFile(targetPath);
    existingJson = JSON.parse(existing.toString('utf-8'));
  } catch(e) {}

  existingJson = {
    ...EN,
    ...existingJson,
  };

  await fs.promises.writeFile(targetPath, JSON.stringify(existingJson, null, 2));
  console.log(`saved ${targetPath}`);
  return process.exit();
})();
