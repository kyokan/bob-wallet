import walletClient from "../../utils/walletClient";

async function getStats() {
  // Live Auctions
  let biddingHNS = 0;
  let biddingNum = 0;

  // In Reveals
  let revealingHNS = 0;
  let revealingNum = 0;

  // Actionable
  let revealableHNS = 0;
  let revealableNum = 0;
  let revealableBlock = null;
  let redeemableHNS = 0;
  let redeemableNum = 0;
  let registerableHNS = 0;
  let registerableNum = 0;
  let transferringDomains = new Set();
  let transferringBlock = null;
  let finalizableDomains = new Set();
  let renewableDomains = new Set();
  let renewableBlock = null;

  // All bids
  const bids = await walletClient.getBids();
  console.log("bids", bids);

  for (let bid of bids) {
    // Don't bother if not own bid
    if (!bid.own) {
      continue;
    }

    const blind = bid.lockup - bid.value;
    const auction = await walletClient.getAuctionInfo(bid.name);
    console.log(auction);

    // Full bid + blind is locked up in the bidding phase
    if (auction.state === "BIDDING") {
      biddingNum++;
      biddingHNS += bid.lockup;
      continue;
    }

    // Only care about auctions in REVEAL and CLOSED
    if (auction.state !== "REVEAL" && auction.state !== "CLOSED") {
      continue;
    }

    // If in reveal, first assume that the bid is not yet revealed and the whole amount is locked up
    // Subtract later if a reveal is found
    if (auction.state === "REVEAL") {
      revealingHNS += bid.lockup;
      revealingNum++;
    }

    // Search for reveal of this bid
    let isRevealed = false;
    let revealPrevOut = null;
    for (let reveal of auction.reveals) {
      const revealTx = await walletClient.getTX(reveal.prevout.hash);
      console.log("revealTx", auction.name, bid.value, revealTx);
      const inputIdx = revealTx.tx.inputs.reduce((cur, input, idx) => {
        if (cur != null) return cur;
        if (
          input.prevout.hash === bid.prevout.hash &&
          input.prevout.index === bid.prevout.index
        )
          return idx;
        return null;
      }, null);
      if (inputIdx != null) {
        // This reveal is for the current bid => Bid is revealed
        isRevealed = true;
        revealPrevOut = { hash: reveal.prevout.hash, index: inputIdx };
        break;
      }
    }

    // If bid not yet revealed and is in reveal period
    if (!isRevealed) {
      if (auction.state === "REVEAL") {
        revealableHNS += blind;
        revealableNum++;
        if (
          revealableBlock === null ||
          auction.stats.blocksUntilClose < revealableBlock
        ) {
          revealableBlock = auction.stats.blocksUntilClose;
        }
      }
      continue;
    }

    // At this point, the bid is revealed (at least)

    // If still in reveal period, the blind is no longer locked
    if (auction.state === "REVEAL") {
      revealingHNS -= blind;
      continue;
    }

    // Get the reveal coin from wallet
    const revealCoin = await walletClient.getCoin(
      revealPrevOut.hash,
      revealPrevOut.index
    );
    console.log("revealCoin", auction.name, bid.value, revealCoin);

    // Check if the reveal coin is the owner of the name
    const isOwner =
      auction.owner.hash === revealPrevOut.hash &&
      auction.owner.index === revealPrevOut.index;
    console.log("isOwner", isOwner);

    // If the reveal coin is the owner, then the name is registerable
    if (isOwner) {
      registerableHNS += auction.highest - auction.value;
      registerableNum++;
      continue;
    }

    // If reveal coin exists, but not owner, then it is redeemable
    if (revealCoin) {
      // Is local?
      // if (coin.height < ns.height)
      //   continue;
      redeemableHNS += bid.value;
      redeemableNum++;
    }

    // Mark for renew if the name is going to expire in the next 2 months
    if (auction.stats.daysUntilExpire < 30 * 2) {
      renewableDomains.add(auction.name);
      if (
        renewableBlock === null ||
        auction.stats.blocksUntilExpire < renewableBlock
      ) {
        renewableBlock = auction.stats.blocksUntilExpire;
      }
    }

    // Names being transferred?
    if (auction.transfer !== 0) {
      // Either finalizable now, or not
      if (auction.stats.blocksUntilValidFinalize <= 0) {
        finalizableDomains.add(auction.name);
      } else {
        transferringDomains.add(auction.name);
        if (
          transferringBlock === null ||
          auction.stats.blocksUntilValidFinalize < transferringBlock
        ) {
          transferringBlock = auction.stats.blocksUntilValidFinalize;
        }
      }
    }
  }

  // locked Bidding = bids in BIDDING state auctions
  // locked Reveal = bids in REVEAL state auctions, regardless of revealed or not (sum of true bids / with blinds?)
  // locked Finished = bids that can be REDEEMed or REGISTERed
  return {
    lockedBalance: {
      bidding: { HNS: biddingHNS, num: biddingNum },
      revealing: { HNS: revealingHNS, num: revealingNum },
      finished: {
        HNS: registerableHNS + redeemableHNS,
        num: registerableNum + redeemableNum,
      },
    },
    actionableInfo: {
      revealable: {
        HNS: revealableHNS,
        num: revealableNum,
        block: revealableBlock,
      },
      redeemable: { HNS: redeemableHNS, num: redeemableNum },
      registerable: { HNS: registerableHNS, num: registerableNum },
      renewable: {
        domains: renewableDomains,
        block: renewableBlock,
      },
      transferring: {
        domains: transferringDomains,
        block: transferringBlock,
      },
      finalizable: { domains: finalizableDomains },
    },
  };
}

async function getUsdConversion() {
  try {
    const response = await (
      await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=handshake&vs_currencies=usd"
      )
    ).json();
    return response.handshake.usd ?? 0;
  } catch (error) {
    return 0;
  }
}

export async function updateBalanceAndCardsData(spendableBalance, setState) {
  // Start API call to get USD conversion rate (non-blocking)
  getUsdConversion().then((HNSToUSD) => {
    setState({
      spendableBalance: {
        HNS: spendableBalance,
        USD: spendableBalance * HNSToUSD,
      },
    });
  });

  // Get and set stats
  try {
    const stats = await getStats();
    setState({
      isLoadingStats: false,
      ...stats,
    });
  } catch (error) {
    console.error(error);
    setState({ isLoadingStats: false });
  }
}
