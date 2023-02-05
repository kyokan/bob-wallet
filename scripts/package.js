const path = require('path');
const fs = require('fs');
const exec = require('child_process').exec;
const rootDir = path.resolve(path.join(__dirname, '..'));
const binDir = path.join(rootDir, 'node_modules', '.bin');
const webpackBin = path.join(binDir, 'webpack.cmd');
const babelBin = path.join(binDir, 'babel.cmd');

console.log(`Packaging from root directory ${rootDir}.`);

function mkdirPFromRoot(dir, cb) {
  fs.mkdir(path.join(rootDir, dir), {recursive: true}, (err) => {
    if (err) {
      throw err;
    }
    console.log(`Created directory ${dir}.`);
    cb();
  });
}

function copyFileFromRoot(source, dest, cb) {
  fs.copyFile(path.join(rootDir, source), path.join(rootDir, dest, path.basename(source)), (err) => {
    if (err) {
      throw err;
    }
    console.log(`Copied ${source} to ${dest}.`);
    cb();
  });
}

function webpack(cb) {
  console.log('Executing webpack.');

  exec(`"${webpackBin}" --config "${path.join(rootDir, 'configs', 'webpack.config.renderer.prod.babel.js')}"`, {
    NODE_ENV: 'production',
  }, (err, stdout, stderr) => {
    if (err) {
      throw err;
    }

    console.log('Webpack output:');
    console.log(stdout);
    cb();
  });
}

function babelizeFromRoot(source, dest, isDir, cb) {
  console.log(`Babelizing ${isDir ? 'directory' : 'file'} ${source} to ${dest}.`);

  exec(`"${babelBin}" "${path.join(rootDir, source)}" -${isDir ? 'd' : 'o'} "${path.join(rootDir, dest)}"`, (err, stdout, stderr) => {
    if (err) {
      throw err;
    }

    console.log('Babel output:');
    console.log(stdout);

    cb();
  });
}

function main() {
  const babelDirectories = [
    'background',
    'constants',
    'db',
    'utils'
  ];
  const babelizeDirectories = () => {
    if (!babelDirectories.length) {
      return;
    }
    babelizeFromRoot(path.join('app', babelDirectories[0]), path.join('dist', babelDirectories[0]), true, () => {
      babelDirectories.shift();
      babelizeDirectories();
    });
  };

  const babelFiles = [
    'main.js',
    'menu.js',
    'sentry.js',
    'mainWindow.js',
    'preload.js',
    'ducks/nodeReducer.js',
    'ducks/hip2Reducer.js',
    'ducks/walletReducer.js',
    'ducks/claims.js',
    'ducks/notifications.js'
  ];
  const babelizeFiles = () => {
    if (!babelFiles.length) {
      babelizeDirectories();
      return;
    }
    babelizeFromRoot(path.join('app', babelFiles[0]), path.join('dist', babelFiles[0]), false, () => {
      babelFiles.shift();
      babelizeFiles();
    });
  };
  const pack = () => webpack(babelizeFiles);
  const cpApp = () => copyFileFromRoot(path.join('app', 'app.html'), 'dist', pack);
  const mkDist = () => mkdirPFromRoot('dist', cpApp);
  mkDist();
}

main();
