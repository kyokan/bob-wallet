import React from 'react';
import './progress-bar.scss';

const ProgressBar = (props) => {
  return (
    <div className='progress-bar'> 
      <div className='progress-bar__filler' style={{ width: `${props.percentage}% `}} />
    </div>
  )
}

export default ProgressBar;