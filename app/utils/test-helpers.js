import sinon from 'sinon';

export const createMockStore = (initialState = {}) => {
  return {
    getState: () => initialState,
    subscribe: sinon.stub(),
    dispatch: sinon.stub(),
  }
};
