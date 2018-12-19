import React from 'react';
import c from 'classnames';
import './index.scss';

export const ContentArea = ({ children, title, noPadding } = props) => (
  <div className="content-area">
    <div
      className={c('content-area__title', {
        'content-area__title__no-padding': noPadding
      })}
    >
      {title}
    </div>
    <div className="content-area__content">{children}</div>
  </div>
);
