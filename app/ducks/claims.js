import { clientStub as claimClientStub } from "../background/claim/client.js";

const claim = claimClientStub(() => require("electron").ipcRenderer);

export const AIRDROP_CLAIM_START = "claims/airdrop/start";
export const AIRDROP_CLAIM_STATUS_UPDATE = "cliams/airdrop/status_update";
export const AIRDROP_CLAIM_END = "claims/airdrop/end";

function getInitialState() {
  return {
    airdropIsGenerating: false,
    airdropStatus: {
      status: "",
      percent: 0,
    },
    airdropProofs: null,
  };
}

export const airdropClaim = (options) => async (dispatch, getState) => {
  const { airdropIsGenerating } = getState();

  if (airdropIsGenerating) return;

  dispatch({
    type: AIRDROP_CLAIM_START,
    payload: {
      airdropStatus: {
        status: "",
        percent: 0,
      },
      airdropProofs: null,
    },
  });

  try {
    const proofs = await claim.airdropGenerateProofs(options);

    dispatch({
      type: AIRDROP_CLAIM_END,
      payload: { airdropProofs: proofs },
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: AIRDROP_CLAIM_STATUS_UPDATE,
      payload: { status: error.message, percent: 100 },
    });
    dispatch({
      type: AIRDROP_CLAIM_END,
      payload: { airdropProofs: [] },
    });
  }
};

export default function reducer(state = getInitialState(), action = {}) {
  switch (action.type) {
    case AIRDROP_CLAIM_START:
      return { ...state, airdropIsGenerating: true, ...action.payload };
    case AIRDROP_CLAIM_STATUS_UPDATE:
      return { ...state, airdropStatus: action.payload };
    case AIRDROP_CLAIM_END:
      return { ...state, airdropIsGenerating: false, ...action.payload };
    default:
      return state;
  }
}
