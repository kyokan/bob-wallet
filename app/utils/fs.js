import fs from 'fs';

export async function awaitFSNotBusy(lockPath, count = 0) {
  if (count === 3) {
    throw new Error('timeout exceeded');
  }

  return new Promise((resolve, reject) => {
    fs.open(lockPath, 'r+', (err, fd) => {
      if (err && err.code === 'ENOENT') {
        return resolve();
      }

      if (err && err.code === 'EBUSY') {
        return setTimeout(() => awaitFSNotBusy(lockPath, count + 1).then(resolve).catch(reject), 500);
      }

      if (err) {
        return reject(err);
      }

      fs.closeSync(fd);
      fs.unlink(lockPath, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  });
}
