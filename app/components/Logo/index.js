import React from 'react';
import c from 'classnames';
import './logo.scss';

export function Logo(props) {
  return (
    <div
      className={c('logo', {
        'logo--clickable': props.onClick
      })}
      onClick={props.onClick}
    >
      <span className="logo__bob" />
    </div>
  );
}
