import React from 'react';
import './index.scss';

export default function Submittable(props) {
  return (
    <form onSubmit={submitter(props.onSubmit)}>
      {props.children}
      <button type="submit" className="submittable__submit" />
    </form>
  );
}

function submitter(onSubmit) {
  return (e) => {
    e.preventDefault();
    onSubmit(e);
  };
}