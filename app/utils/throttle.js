// https://stackoverflow.com/a/27078401/1724828
export function throttle(callback, limit) {
  var waiting = false;                      // Initially, we're not waiting
  return function () {                      // We return a throttled function
      if (!waiting) {                       // If we're not waiting
          callback.apply(this, arguments);  // Execute users function
          waiting = true;                   // Prevent future invocations
          setTimeout(function () {          // After a period of time
              waiting = false;              // And allow future invocations
          }, limit);
      }
  }
}

export function debounce(func, timeout){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}
