import { Client } from "xrpl";

async function main() {
  const client = new Client(process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz");
  await client.connect();
  const response = await client.fundWallet(null, {
    faucetHost: "batch.faucet.nerdnest.xyz",
    faucetPath: "/accounts",
  });
  console.log(response);

  await client.disconnect();
}

main();
