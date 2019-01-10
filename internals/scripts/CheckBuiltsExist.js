// Check if the renderer and main bundles are built
import path from 'path';
import fs from 'fs';

function CheckBuildsExist() {
  const mainPath = path.join(__dirname, '..', '..', 'app', 'main.prod.js');
  const rendererPath = path.join(
    __dirname,
    '..',
    '..',
    'app',
    'dist',
    'renderer.prod.js'
  );

  if (!fs.existsSync(mainPath)) {
    throw new Error('The main process is not built yet. Build it by running "yarn build-main"');
  }

  if (!fs.existsSync(rendererPath)) {
    throw new Error('The renderer process is not built yet. Build it by running "yarn build-renderer"');
  }
}

CheckBuildsExist();
