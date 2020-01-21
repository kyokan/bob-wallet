window.addEventListener('DOMContentLoaded', () => {
  const scripts = [];
  const port = process.env.PORT || 1212;
  scripts.push(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:' + port + '/dist/renderer.js'
      : './renderer.js',
  );

  scripts.map((script) => {
    const el = document.createElement('script');
    el.src = script;
    el.defer = true;
    return el;
  }).forEach((el) => {
    document.body.appendChild(el);
  });

  if (process.env.NODE_ENV !== 'development') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './style.css';
    document.getElementsByTagName('head')[0].appendChild(link);
  }
});
