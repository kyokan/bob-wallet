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
      <span className="logo__allison">Allison</span>{' '}
      <span className="logo__and">and</span>{' '}
      <span className="logo__bob">Bob</span>
    </div>
  );
}
