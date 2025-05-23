import { Client, ECDSA, Wallet, Payment } from "xrpl";
import { sign } from "ripple-keypairs";
import { encode, encodeForSigning, XrplDefinitions } from "ripple-binary-codec";
import { addBatchTxn, RawTransaction } from "./helpers";

async function main() {
  const client = new Client(
    process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz",
  );
  await client.connect();
  const alice: Wallet = Wallet.fromSeed("sEdTfLp3JkQTPRUMo7BYXFFYSZ2ddcV");
  const bob: Wallet = Wallet.fromSeed("sEdSQnqSZxp7xhiiz2z6D8zjsBBMEpC");
  const carol: Wallet = Wallet.fromSeed("sEdVkb8YEaq85irhP8SXsFkQuXdT4DP");

  const accountInfo = await client.request({
    command: "account_info",
    account: alice.classicAddress,
  });

  const liveDefinitions = await client.request({
    command: "server_definitions",
  });
  const _liveDefinitions = JSON.parse(JSON.stringify(liveDefinitions.result));
  const definitions = new XrplDefinitions(_liveDefinitions);

  const seq = accountInfo.result.account_data.Sequence;
  const tx: { [key: string]: any } = {
    Account: alice.classicAddress,
    TransactionType: "Batch",
    Flags: 65536,
    Fee: "50",
    SigningPubKey: alice.publicKey,
    RawTransactions: [] as RawTransaction[],
  };

  const payment1: Payment = {
    TransactionType: "Payment",
    Account: alice.classicAddress,
    Destination: bob.classicAddress,
    Amount: "100000",
    Flags: 1073741824,
  };
  addBatchTxn(tx, payment1, seq + 1);

  const payment2: Payment = {
    TransactionType: "Payment",
    Account: alice.classicAddress,
    Destination: carol.classicAddress,
    Amount: "100000",
    Flags: 1073741824,
  };
  addBatchTxn(tx, payment2, seq + 2);

  // @ts-ignore -- ignore
  const preparedTxn = await client.autofill(tx);
  console.log(JSON.stringify(preparedTxn, null, 2));
  // console.log(definitions)

  const encoded = encodeForSigning(preparedTxn, definitions);
  const signed = sign(encoded, alice.privateKey);
  preparedTxn.TxnSignature = signed;
  const txBlob = encode(preparedTxn, definitions);

  const submit = await client.request({
    command: "submit",
    tx_blob: txBlob,
  });

  console.log(submit);
  if (client.connection.getUrl() === "ws://localhost:6006") {
    await client.request({
      // @ts-ignore -- ignore
      command: "ledger_accept",
    });
  }

  await client.disconnect();
}

main();
