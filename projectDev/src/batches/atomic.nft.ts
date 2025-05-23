import {
  Client,
  Wallet,
  decodeAccountID,
  NFTokenMint,
  convertStringToHex,
  NFTokenCreateOffer,
  NFTokenAcceptOffer,
} from "xrpl";
import { sign } from "ripple-keypairs";
import { encode, encodeForSigning, XrplDefinitions } from "ripple-binary-codec";
import {
  addBatchSignature,
  addBatchTxn,
  BatchSigner,
  RawTransaction,
} from "./helpers";
import { createHash } from "crypto";

/**
 * unscramble taxon
 * @param taxon taxon number
 * @param token_seq token sequence number
 * @returns unscrambled taxon number
 */
function unscrambleTaxon(taxon: number, token_seq: number): number {
  return (taxon ^ (384160001 * token_seq + 2459)) % 4294967296;
}

/**
 * Builds a NFToken ID from the given parameters.
 *
 * @param flags - The flags for the NFToken.
 * @param fee - The fee for the NFToken.
 * @param account - The account that owns the NFToken.
 * @param sequence - The sequence number of the NFToken.
 * @param taxon - The taxon of the NFToken.
 * @returns The NFToken ID.
 */
export function buildNFTokenID(
  flags: number,
  fee: number,
  account: string,
  sequence: number,
  taxon: number,
): string {
  const prefix = Buffer.alloc(1);
  const flagByteInt = Buffer.alloc(1);
  const feeByteInt = Buffer.alloc(2);
  const decodeResult = decodeAccountID(account);
  const sequenceByteInt = Buffer.alloc(4);
  const taxonByteInt = Buffer.alloc(4);

  prefix.writeUInt8(0, 0);
  flagByteInt.writeUInt8(flags, 0);
  feeByteInt.writeUInt16BE(fee, 0);
  sequenceByteInt.writeUInt32BE(sequence, 0);
  taxonByteInt.writeUInt32BE(unscrambleTaxon(taxon, sequence), 0);

  const nftokenId = Buffer.concat([
    prefix,
    flagByteInt,
    feeByteInt,
    decodeResult,
    taxonByteInt,
    sequenceByteInt,
  ]);

  return nftokenId.toString("hex").toUpperCase();
}

/**
 * Builds the NFToken Offer ID
 * @param account Account that initiated the offer tx
 * @param sequence Sequence on the offer tx
 * @returns Offer ID
 */
export function buildNFTokenOfferID(account: string, sequence: number): string {
  const decodeResult: any = decodeAccountID(account);
  const sequenceByteInt = Buffer.alloc(4);
  sequenceByteInt.writeUInt32BE(sequence, 0);
  const offerBytes: Buffer = Buffer.concat([
    Buffer.from([0x00, 0x71]),
    decodeResult,
    sequenceByteInt,
  ]);
  const offerHash = createHash("sha512").update(offerBytes).digest();
  return offerHash.slice(0, 32).toString("hex").toUpperCase();
}

export async function mintNFT(client: Client, wallet: Wallet) {
  const buiiltTx: NFTokenMint = {
    TransactionType: "NFTokenMint",
    Account: wallet.classicAddress,
    URI: convertStringToHex("https://example.com"),
    NFTokenTaxon: 0,
  };
  const preparedTxn = await client.autofill(buiiltTx);
  const txBlob = await customSign(client, wallet, preparedTxn);
  const submit = await client.request({
    command: "submit",
    tx_blob: txBlob,
  });
  console.log(submit);
  return buildNFTokenID(
    preparedTxn.Flags as number,
    Number(preparedTxn.Fee),
    preparedTxn.Account,
    Number(preparedTxn.Sequence),
    preparedTxn.NFTokenTaxon,
  );
}

export async function customSign(
  client: Client,
  wallet: Wallet,
  preparedTxn: any,
): Promise<string> {
  const liveDefinitions = await client.request({
    command: "server_definitions",
  });
  const _liveDefinitions = JSON.parse(JSON.stringify(liveDefinitions.result));
  const definitions = new XrplDefinitions(_liveDefinitions);
  preparedTxn.SigningPubKey = wallet.publicKey;
  const encoded = encodeForSigning(preparedTxn, definitions);
  const signed = sign(encoded, wallet.privateKey);
  preparedTxn.TxnSignature = signed;
  const txBlob = encode(preparedTxn, definitions);
  return txBlob;
}

async function main() {
  const client = new Client(
    process.env.WSS_ENDPOINT || "wss://batch.nerdnest.xyz",
  );
  await client.connect();
  const alice: Wallet = Wallet.fromSeed("sEdTmoYV29SfFRKNUQiN5hpyYWQqSiF");
  const bob: Wallet = Wallet.fromSeed("sEdSj7hpVWZk4dbcxdkYTX7nqZ3hvc3");

  console.log("Alice:", alice.classicAddress);
  console.log("Bob:", bob.classicAddress);

  // const aliceNFTID = await mintNFT(client, alice)
  const aliceNFTID =
    "00000000FEAD8D3F3B69F30DC660EAA04DD6883BF9BB7B3FC2DF775C0000DCC1";
  // const bobNFTID = await mintNFT(client, bob)
  const bobNFTID =
    "00000000B674FF1F5525666BB562420F70AF9FD6BB79CAAC355C8C610000DCC6";

  console.log("Alice NFT ID:", aliceNFTID);
  console.log("Bob NFT ID:", bobNFTID);

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
  const numberOfTxns = 4;

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
  const offer1: NFTokenCreateOffer = {
    TransactionType: "NFTokenCreateOffer",
    Account: alice.classicAddress,
    Destination: bob.classicAddress,
    Amount: "5000000",
    Flags: 1073741825,
    NFTokenID: aliceNFTID,
  };
  addBatchTxn(tx, offer1, aliceSequence + 1);

  const accept1: NFTokenAcceptOffer = {
    TransactionType: "NFTokenAcceptOffer",
    Account: bob.classicAddress,
    NFTokenSellOffer: buildNFTokenOfferID(
      alice.classicAddress,
      aliceSequence + 1,
    ),
    Flags: 1073741824,
  };
  addBatchTxn(tx, accept1, bobSequence);

  // ADD BATCH TXN
  const offer2: NFTokenCreateOffer = {
    TransactionType: "NFTokenCreateOffer",
    Account: bob.classicAddress,
    Destination: alice.classicAddress,
    Amount: "1000000",
    Flags: 1073741825,
    NFTokenID: bobNFTID,
  };
  addBatchTxn(tx, offer2, bobSequence + 1);

  const accept2: NFTokenAcceptOffer = {
    TransactionType: "NFTokenAcceptOffer",
    Account: alice.classicAddress,
    NFTokenSellOffer: buildNFTokenOfferID(bob.classicAddress, bobSequence + 1),
    Flags: 1073741824,
  };
  addBatchTxn(tx, accept2, aliceSequence + 2);

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
