import React from 'react';
import './vickrey-process.scss';

export default function VickreyProcess() {
  return (
    <div className="vickrey-process">
      <p>
        To prevent price sniping, Handshake uses a blind second-price auction called a Vickrey Auction.
        Users can buy and register top-level domains (TLDs) with Handshake coins (HNS).
      </p>
      <p>
        In a Vickrey Auction, a participant is only aware of their own bid. The bids are revealed at the end
        of the auction when a winner is chosen. The winner pays the second highest bid instead of his
        or her own.
      </p>
      <ul>
        <li>Names are released weekly during a pre-determined 52 week schedule</li>
        <li>Blind bids can be placed any time after a name is released</li>
        <li>Bidding is open to everyone for 5 days after the reveal period</li>
        <li>Bidders have 10 days to reveal their bid price</li>
        <li>A winner is assigned the name and pays the second highest bid at the end of the reveal period</li>
        <li>The winning bid is burned and permanently removed from circulation</li>
        <li>Losing bids are returned</li>
        <li>Names are renewed annually by paying standard network fee.</li>
      </ul>
      <p>For more information, read the Handshake <a href="https://handshake.org/files/handshake.txt">paper</a>.</p>
    </div>
  );
}
