import { Transaction, Wallet } from "xrpl";
import { sign } from "ripple-keypairs";
import { BytesList } from "ripple-binary-codec/dist/serdes/binary-serializer";
import { UInt32, Hash256 } from "ripple-binary-codec/dist/types";
import { transactionID } from "ripple-binary-codec/dist/hashes";
import { encode } from "ripple-binary-codec";

export interface RawTransaction {
  RawTransaction: Transaction;
}

export interface BatchTxn {
  BatchTxn: {
    OuterAccount: string;
    Sequence: number;
    TicketSequence?: number;
    BatchIndex: number;
  };
}

export interface BatchSigner {
  BatchSigner: {
    Account: string;
    SigningPubKey: string;
    TxnSignature: string;
  };
}

export interface BatchObject {
  flags: number;
  txIDs: string[];
}

export const calculateBatchIndex = (
  batch: any,
  account: string,
  ticket?: number,
) => {
  let index = 0;

  if (ticket) {
    // Calculate batch index based on TicketSequence
    index = batch.RawTransactions.filter(
      (txn: any) =>
        txn.RawTransaction.TicketSequence !== undefined &&
        txn.RawTransaction.Sequence === 0 &&
        txn.RawTransaction.Account === account,
    ).length;
  } else {
    // Calculate batch index based on Sequence
    index = batch.RawTransactions.filter(
      (txn: any) =>
        txn.RawTransaction.Sequence !== undefined &&
        txn.RawTransaction.Account === account,
    ).length;
  }

  // Check if the account matches the outer batch account
  if (account === batch.Account) {
    index += 1; // Add an extra 1 if it matches
  }

  return index;
};

// Use a global variable for browser, fallback to process.env for Node.js
const getNetworkId = () => {
  if (typeof window !== 'undefined' && (window as any).VITE_NETWORKID) {
    return Number((window as any).VITE_NETWORKID);
  }
  if (typeof process !== 'undefined' && process.env.NETWORKID) {
    return Number(process.env.NETWORKID);
  }
  return 21336; // default
};

export const addBatchTxn = (
  batch: any,
  tx: Transaction,
  sequence: number,
  ticket?: number,
) => {
  const rawTx = {
    RawTransaction: {
      ...tx,
      NetworkID: getNetworkId(),
      Fee: "0",
      Sequence: sequence,
      SigningPubKey: "",
    },
  };
  if (ticket) {
    rawTx.RawTransaction.TicketSequence = ticket;
  }
  batch.RawTransactions.push(rawTx);
  return batch;
};

function toHex(uint8Array: any) {
  return (
    Array.from(uint8Array)
      // @ts-expect-error -- ignore
      .map((byte) => byte.toString(16).padStart(2, "0")) // Convert each byte to hex and pad with zeros
      .join("")
  ); // Join all hex values into a single string
}

function bytes(uint32: number): Uint8Array {
  const result = new Uint8Array(4);
  result[0] = (uint32 >>> 24) & 0xff;
  result[1] = (uint32 >>> 16) & 0xff;
  result[2] = (uint32 >>> 8) & 0xff;
  result[3] = uint32 & 0xff;
  return result;
}

function signingBatchData(flags: any, ids: any[]): Uint8Array {
  // const prefix = HashPrefix.batch
  const prefix = bytes(0x42434800);
  const bytesList: Uint8Array[] = [];
  bytesList.push(prefix);
  // Add Flags
  const _flags = UInt32.from(flags).toBytes();
  bytesList.push(_flags);
  // Add TxnIDs Length
  const txIDsLength = UInt32.from(ids.length).toBytes();
  bytesList.push(txIDsLength);
  // Add TxnIDs
  ids.forEach((txID: string) => {
    const txid = Hash256.from(txID).toBytes();
    bytesList.push(txid);
  });
  // Concatenate all Uint8Arrays
  let totalLength = bytesList.reduce((sum, arr) => sum + arr.length, 0);
  let result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of bytesList) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function encodeForSigningBatch(flags: any, ids: string[]): string {
  return toHex(signingBatchData(flags, ids));
}

export const addBatchSignature = (
  definitions: any,
  batch: any,
  wallet: Wallet,
) => {
  const ids = batch.RawTransactions.map((txn: any) => {
    return transactionID(
      // Buffer.from(encode(txn.RawTransaction, definitions), "hex"),
      new Uint8Array(
        (encode(txn.RawTransaction, definitions).match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
      ),
    ).toHex();
  });
  const encoded = encodeForSigningBatch(batch.Flags, ids);

  const signature = sign(encoded, wallet.privateKey);
  const batchSignature = {
    BatchSigner: {
      Account: wallet.classicAddress,
      SigningPubKey: wallet.publicKey,
      TxnSignature: signature,
    },
  };
  batch.BatchSigners.push(batchSignature);
  return batch;
};
