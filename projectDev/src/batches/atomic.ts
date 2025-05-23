import { Client, ECDSA, Wallet, Payment } from "xrpl";
import { sign } from "ripple-keypairs";
import { encode, encodeForSigning, XrplDefinitions } from "ripple-binary-codec";
import {
  addBatchSignature,
  addBatchTxn,
  BatchSigner,
  RawTransaction,
} from "./helpers";

async function main() {
  const client = new Client(
    process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz",
  );
  await client.connect();
  const alice: Wallet = Wallet.fromSeed("sEd7HmQFsoyj5TAm6d98gytM9LJA1MF");
  const bob: Wallet = Wallet.fromSeed("spkcsko6Ag3RbCSVXV2FJ8Pd4Zac1", {
    algorithm: ECDSA.secp256k1,
  });

  console.log("Alice:", alice.classicAddress);
  console.log("Bob:", bob.classicAddress);

  // PREPARE FOR TXN
  const feeInfo = await client.request({
    command: "fee",
  });
  const feeDrops = Number(feeInfo.result.drops.open_ledger_fee);

  const aliceInfo = await client.request({
    command: "account_info",
    account: alice.classicAddress,
  });
  const aliceSequence = aliceInfo.result.account_data.Sequence;

  const bobInfo = await client.request({
    command: "account_info",
    account: bob.classicAddress,
  });

  const liveDefinitions = await client.request({
    command: "server_definitions",
  });
  const _liveDefinitions = JSON.parse(JSON.stringify(liveDefinitions.result));
  const definitions = new XrplDefinitions(_liveDefinitions);

  const bobSequence = bobInfo.result.account_data.Sequence;
  const numberOfSigners = 2;
  const numberOfTxns = 2;

  // CREATE TXN
  const tx: { [key: string]: any } = {
    Account: alice.classicAddress,
    TransactionType: "Batch",
    Flags: 65536,
    Fee: String((numberOfSigners + 2) * feeDrops + feeDrops * numberOfTxns),
    SigningPubKey: alice.publicKey,
    RawTransactions: [] as RawTransaction[],
    TransactionIDs: [] as string[],
  };

  // ADD BATCH TXN
  const payment1: Payment = {
    TransactionType: "Payment",
    Account: alice.classicAddress,
    Destination: bob.classicAddress,
    Amount: "5000000",
    Flags: 1073741824,
  };
  addBatchTxn(tx, payment1, aliceSequence + 1);

  // ADD BATCH TXN
  const payment2: Payment = {
    TransactionType: "Payment",
    Account: bob.classicAddress,
    Destination: alice.classicAddress,
    Amount: "1000000",
    Flags: 1073741824,
  };
  addBatchTxn(tx, payment2, bobSequence);

  tx.BatchSigners = [] as BatchSigner[];

  // @ts-ignore -- ignore
  const preparedTxn = await client.autofill(tx);

  // SIGN BATCH TXN
  addBatchSignature(definitions, preparedTxn, bob);

  preparedTxn.SigningPubKey = alice.publicKey;
  const encoded = encodeForSigning(preparedTxn, definitions);
  const signed = sign(encoded, alice.privateKey);
  preparedTxn.TxnSignature = signed;
  const txBlob = encode(preparedTxn, definitions);

  console.log(JSON.stringify(preparedTxn, null, 2));

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
