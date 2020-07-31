import React from 'react';
import c from 'classnames';
import './index.scss';

export const ContentArea = ({ children, title, noPadding, className } = props) => (
  <div className={`content-area ${className}`}>
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
