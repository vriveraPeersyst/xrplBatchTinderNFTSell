
# xrplBatchTinderNFTSell

A toolbox and React front-end for batch-selling NFTs on the XRP Ledger via XLS-56 batch transactions and smart escrows.

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

## Front-end Setup & Development

```bash
cd projectDev
npm install
npm run dev
````

* **Dev server** will open at `http://localhost:5173` by default.
* The React app connects to your XRPL endpoint and walks you through picking which NFTs to batch-sell.

## Environment Variables

Create a `.env` in `projectDev/` with:

```dotenv
VITE_WS=wss://your-xrpl-node.example.org      # WebSocket endpoint
VITE_SEED=your_secret_seed_here               # Wallet seed
```

## Batch-Transaction Examples

Under `projectDev/src/batches/` you’ll find TypeScript scripts demonstrating:

* **Atomic swaps** (`atomic.ts`, `atomic.nft.ts`)
* **Basic batch payments** (`basic.ts`)
* **Smart escrow** demos
* **Faucet funding** (`faucet.ts`)
* **Mass NFT minting** (`mintAll.ts`)

Run any of them via:

```bash
# from projectDev/
npm run build      # pre-compile, if needed
npm start -- <scriptName>
# e.g. npm start -- basic
```

> *Or* just `ts-node src/batches/basic.ts` if you prefer.

## Generating a Repository Report

To regenerate `repo_report.txt`, run at the root:

```bash
chmod +x generate_code.sh
./generate_code.sh
```

This will snapshot your directory tree and key file contents.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/xyz`)
3. Commit your changes (`git commit -m "Add XYZ"`)
4. Push and open a Pull Request

---

Enjoy automating your NFT batch-sells on XRPL!
