export default function pify(actor) {
  return new Promise((resolve, reject) => actor((err, res) => {
    if (err) {
      return reject(err);
    }

    return resolve(res);
  }));
}
