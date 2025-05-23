# xrplBatchTinderNFTSell

A toolbox and React front-end for batch-selling NFTs on the XRP Ledger via XLS-56 batch transactions, plus helper scripts for minting.

## Repository Structure

```

xrplBatchTinderNFTSell
├── correctBatchResultRaw\.txt       # Sample raw batch-sell output
├── generate\_code.sh                # Generates `repo_report.txt`
├── projectDev                      # React/TypeScript front-end
│   ├── README.md                   # Front-end usage & setup
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src
│       ├── batchTinderSellNFTs     # UI to pick & batch-sell your NFTs
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── batches                 # Batch-transaction examples & helpers
│           ├── atomic.nft.ts
│           ├── atomic.ts
│           ├── basic.ts
│           ├── faucet.ts
│           ├── helpers.ts
│           └── mintAll.ts
├── repo\_report.txt                 # Generated repo summary
└── correctBatchResultRaw\.txt       # Sample batch result

````

## Prerequisites

- [Node.js](https://nodejs.org/) v14+
- npm (or yarn/pnpm)
- TypeScript (`npm install -g typescript`) if you run `.ts` scripts directly.

---

## Front-end Setup & Key Code Snippet

```bash
cd projectDev
npm install
npm run dev
````

Your React entrypoint, **App.tsx**, begins with:

```ts
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
```

This sets up your hooks, XRPL client, batch helpers, codec and signing utilities. It then walks you through fetching NFTs, choosing which to sell, and assembling the XLS-56 batch.

---

## Batch-Mint Script

Under `projectDev/src/batches/mintAll.ts` you’ll find:

```ts
import { Client, Wallet, NFTokenMint } from "xrpl";

async function main() {
  const client = new Client(process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz");
  await client.connect();
  const wallet = Wallet.fromSeed(process.env.SEED || "sEd7VTR8AKKsj9rAMRs764zfxVjZ1ep");

  // Example NFT URIs to mint
  const nftUris = [
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    /* …more URIs… */
  ];

  let seqResp = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
  });
  let seq = seqResp.result.account_data.Sequence;

  for (let i = 0; i < nftUris.length; i++) {
    const mint: NFTokenMint = {
      TransactionType: "NFTokenMint",
      Account: wallet.classicAddress,
      URI: Buffer.from(nftUris[i]).toString("hex"),
      Flags: 8, // Transferable
      Fee: "5000",
      Sequence: seq + i,
      NFTokenTaxon: 0,
    };
    const prepared = await client.autofill(mint);
    const signed = wallet.sign(prepared);
    const submit = await client.submitAndWait(signed.tx_blob);
    console.log(`Minted NFT for URI: ${nftUris[i]}`, submit.result);
  }

  await client.disconnect();
}

main().catch(console.error);
```

Run it via:

```bash
# from projectDev/
ts-node src/batches/mintAll.ts
```

---

## Environment Variables

Create a `.env` in `projectDev/`:

```dotenv
VITE_WS=wss://your-xrpl-node.example.org
VITE_SEED=your_secret_seed_here
SEED=your_secret_seed_here       # for mintAll.ts
WSS_ENDPOINT=wss://batch.nerdnest.xyz
```

---

## Scripts & Usage

* **Batch-sell UI**
  `npm run dev` → React app at `localhost:5173`
* **Run any batch example**

  ```bash
  # e.g. for basic.ts
  ts-node src/batches/basic.ts
  ```
* **Mint All NFTs**

  ```bash
  ts-node src/batches/mintAll.ts
  ```
* **Generate repo report**

  ```bash
  chmod +x generate_code.sh
  ./generate_code.sh
  ```

---

## Contributing

1. Fork
2. Branch (`feature/…`)
3. Commit
4. PR

Enjoy streamlining your NFT workflows on XRPL!
