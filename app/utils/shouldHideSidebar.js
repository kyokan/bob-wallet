const HIDDEN_PATHS = [/domains/, /domain\//];

export const shouldHideSidebar = pathname => {
  let isHidden = false;
  HIDDEN_PATHS.forEach(path => {
    if (path.test(pathname)) {
      isHidden = true;
    }
  });
  return isHidden;
};
