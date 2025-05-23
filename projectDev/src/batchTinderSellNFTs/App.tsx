import React, { useState, useEffect } from "react";
import { Client, Wallet, NFTokenCreateOffer } from "xrpl";
import { addBatchTxn, addBatchSignature, RawTransaction, BatchSigner } from "../batches/helpers";
import { XrplDefinitions, encode } from "ripple-binary-codec";
import { sign } from "ripple-keypairs";

declare global {
  interface ImportMeta {
    env: {
      VITE_WS?: string;
      VITE_SEED?: string;
      [key: string]: any;
    };
  }
}

interface NFT {
  NFTokenID: string;
  URI?: string;
}

type SellOffer = { nft: NFT; priceDrops: string };

export default function App() {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [index, setIndex] = useState(0);
  const [sellOffers, setSellOffers] = useState<SellOffer[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function fetchNFTs() {
      const client = new Client(import.meta.env.VITE_WS || "wss://batch.nerdnest.xyz");
      const wallet = Wallet.fromSeed(import.meta.env.VITE_SEED || "sEd7VTR8AKKsj9rAMRs764zfxVjZ1ep");
      await client.connect();
      const resp = await client.request({
        command: "account_nfts",
        account: wallet.classicAddress,
      });
      const nfts = resp.result.account_nfts.map((nft: any) => ({
        NFTokenID: nft.NFTokenID,
        URI: nft.URI ?
          (() => {
            try {
              return decodeURIComponent(
                Array.from(new Uint8Array(
                  nft.URI.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16))
                ))
                  .map((c) => String.fromCharCode(c))
                  .join("")
              );
            } catch {
              return undefined;
            }
          })()
          : undefined,
      }));
      setNfts(nfts);
      await client.disconnect();
    }
    fetchNFTs();
  }, []);

  if (!nfts.length) return <p>Loading NFTs…</p>;
  if (done || index >= nfts.length) return <Summary />;

  const current = nfts[index];

  function onKeep() {
    setIndex(i => i + 1);
  }

  function onSell() {
    const priceXRP = window.prompt("Enter sell price in XRP:");
    if (!priceXRP) return;
    const drops = (Number(priceXRP) * 1_000_000).toString();
    setSellOffers(s => [...s, { nft: current, priceDrops: drops }]);
    setIndex(i => i + 1);
  }

  function onStop() {
    setDone(true);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="border p-4 rounded">
        <p>
          #{index + 1} / {nfts.length}
        </p>
        <p className="font-mono break-all">{current.NFTokenID}</p>
      </div>
      <div className="flex space-x-2">
        <button onClick={onKeep} className="px-4 py-2 bg-gray-200 rounded">
          Keep
        </button>
        <button onClick={onSell} className="px-4 py-2 bg-blue-200 rounded">
          Sell
        </button>
        <button onClick={onStop} className="px-4 py-2 bg-red-200 rounded">
          Stop
        </button>
      </div>
    </div>
  );

  function Summary() {
    async function submitBatch() {
      const client = new Client(import.meta.env.VITE_WS || "wss://batch.nerdnest.xyz");
      await client.connect();
      const wallet = Wallet.fromSeed(import.meta.env.VITE_SEED || "sEd7VTR8AKKsj9rAMRs764zfxVjZ1ep");
      const feeInfo = await client.request({ command: "fee" });
      const feeDrops = Number(feeInfo.result.drops.open_ledger_fee);
      const acct = await client.request({
        command: "account_info",
        account: wallet.classicAddress,
      });
      let seq = acct.result.account_data.Sequence as number;

      // Get server definitions
      const defsResp = await client.request({ command: "server_definitions" });
      // Defensive: Only pass if all required fields are present
      const {
        FIELDS,
        LEDGER_ENTRY_TYPES,
        TRANSACTION_RESULTS,
        TRANSACTION_TYPES,
        TYPES,
      } = defsResp.result;
      if (!FIELDS || !LEDGER_ENTRY_TYPES || !TRANSACTION_RESULTS || !TRANSACTION_TYPES || !TYPES) {
        throw new Error("Incomplete server_definitions response");
      }
      const definitions = new XrplDefinitions({
        FIELDS,
        LEDGER_ENTRY_TYPES,
        TRANSACTION_RESULTS,
        TRANSACTION_TYPES,
        TYPES,
      });

      // Build batch envelope
      const batch: any = {
        Account: wallet.classicAddress,
        TransactionType: "Batch",
        Flags: 0x00010000,
        Fee: String((1 + sellOffers.length) * feeDrops + feeDrops * sellOffers.length),
        RawTransactions: [] as RawTransaction[],
        BatchSigners: [] as BatchSigner[],
      };

      sellOffers.forEach((o, i) => {
        const tx: NFTokenCreateOffer = {
          TransactionType: "NFTokenCreateOffer",
          Account: wallet.classicAddress,
          NFTokenID: o.nft.NFTokenID,
          Amount: o.priceDrops,
          Flags: 1,
        };
        addBatchTxn(batch, tx, seq + 1 + i);
      });

      console.log("Batch envelope before autofill:", JSON.stringify(batch, null, 2));

      // Autofill batch
      const prepared = await client.autofill(batch);

      // Remove fields not required by XLS-56 spec before encoding
      delete prepared.LastLedgerSequence;
      // prepared.SigningPubKey = wallet.publicKey; // Not needed for batch
      // Optionally, increase the fee for testing
      prepared.Fee = String(Math.max(Number(prepared.Fee), 500));
      // Add batch signature (must be after autofill, before encoding)
      addBatchSignature(definitions, prepared, wallet);
      // Set SigningPubKey in all RawTransactions (already done)
      prepared.RawTransactions.forEach((rt: any) => {
        rt.RawTransaction.SigningPubKey = wallet.publicKey;
      });
      // Set SigningPubKey at the top-level ONLY if atomic.nft.ts does so (see reference)
      prepared.SigningPubKey = wallet.publicKey;
      // Remove NetworkID from top-level if not present in atomic.nft.ts
      if (prepared.NetworkID !== undefined) delete prepared.NetworkID;
      console.log("Batch envelope after signature:", JSON.stringify(prepared, null, 2));

      // --- XLS-56: Add top-level signature (TxnSignature) as in atomic.nft.ts ---
      // Import encodeForSigning at the top if not already
      // import { encodeForSigning } from "ripple-binary-codec";
      const { encodeForSigning } = await import("ripple-binary-codec");
      const encodedForSigning = encodeForSigning(prepared, definitions);
      const topLevelSignature = sign(encodedForSigning, wallet.privateKey);
      prepared.TxnSignature = topLevelSignature;
      // --- END XLS-56 fix ---

      const tx_blob = encode(prepared, definitions);
      // No need to sign again with sign(tx_blob, wallet.privateKey) for batch
      // prepared.TxnSignature = signature;

      const submit = await client.request({ command: "submit", tx_blob });
      console.log("Batch Submit:", submit);
      // For local devnet, advance the ledger to process the transaction
      if (client.connection.getUrl && client.connection.getUrl() === "ws://batch.nerdnest.xyz") {
        await client.request({
          // @ts-ignore -- ignore
          command: "ledger_accept",
        });
      }
      await client.disconnect();
      alert("Result: " + (submit.result?.engine_result || submit.result || JSON.stringify(submit)));
    }

    return (
      <div className="p-4">
        <h2 className="text-xl mb-2">Ready to batch-sell:</h2>
        <ul className="list-disc pl-6">
          {sellOffers.map((o, i) => (
            <li key={i}>
              {o.nft.NFTokenID} @ {Number(o.priceDrops) / 1e6} XRP
            </li>
          ))}
        </ul>
        <button
          onClick={submitBatch}
          className="mt-4 px-4 py-2 bg-green-400 rounded"
        >
          Submit Batch Sell
        </button>
      </div>
    );
  }
}
