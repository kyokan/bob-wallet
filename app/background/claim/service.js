import { redeemStart } from "./airdrop";
import { dispatchToMainWindow } from "../../mainWindow";
import { AIRDROP_CLAIM_STATUS_UPDATE } from "../../ducks/claims";

export async function airdropGenerateProofs(options) {
  return redeemStart(options, (update) => {
    dispatchToMainWindow({
      type: AIRDROP_CLAIM_STATUS_UPDATE,
      payload: update,
    });
  });
}

airdropGenerateProofs.suppressLogging = true;

const sName = "Claim";
const methods = {
  airdropGenerateProofs,
};


export function start(server) {
  server.withService(sName, methods);
}
