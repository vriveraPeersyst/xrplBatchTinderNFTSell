import { Client, Wallet, NFTokenMint } from "xrpl";

async function main() {
  const client = new Client(process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz");
  await client.connect();
  const wallet = Wallet.fromSeed(process.env.SEED || "sEd7VTR8AKKsj9rAMRs764zfxVjZ1ep");

  // Example NFT URIs to mint
  const nftUris = [
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P",
    "ipfs://QmS1qEsbRpi9UrjCM5JkmCDdgWf8CWEAyKvNKbkjms919P"
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
