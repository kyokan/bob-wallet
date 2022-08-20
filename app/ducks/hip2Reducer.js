export const SET_HIP2_PORT = 'app/hip2/setHip2Port';

function reduceSetPort(state, action) {
  const { payload: port } = action;

  return {
    ...state,
    port 
  };
}


function getInitialState() {
  return {
    port: 9892
  }
}

export default function hip2Reducer(state = getInitialState(), action) {
  switch (action.type) {
    case SET_HIP2_PORT:
      return reduceSetPort(state, action);
    default:
      return state;
  }
};
