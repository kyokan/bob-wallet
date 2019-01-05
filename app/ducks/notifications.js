export const SHOW = 'notifications/SHOW';
export const CLEAR = 'notifications/CLEAR';

export function showSuccess(message) {
  return show(message, 'success');
}

export function showError(message) {
  return show(message, 'error');
}

export function clear() {
  return {
    type: CLEAR
  };
}

function show(message, type) {
  return {
    type: SHOW,
    payload: {
      message,
      type,
    }
  };
}

function getInitialState() {
  return {
    message: '',
    type: 'success'
  };
}

export default function reducer (state = getInitialState(), action = {}) {
  switch (action.type) {
    case SHOW:
      return { ...state, message: action.payload.message, type: action.payload.type };
    case CLEAR:
      return getInitialState();
    default:
      return state;
  }
}
