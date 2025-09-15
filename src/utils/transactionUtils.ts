// utils/transactionUtils.ts
/**
 * Transaction utilities for Solana payments
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface TransactionFee {
  baseFee: number;
  priorityFee: number;
  totalFee: number;
}

export const estimateTransactionFee = async (
  connection: Connection,
  useHighPriority: boolean = false
): Promise<TransactionFee> => {
  try {
    // Base fee is typically 5000 lamports (0.000005 SOL)
    const baseFee = 5000;

    // Priority fee for faster processing (optional)
    const priorityFee = useHighPriority ? 10000 : 0;

    const totalFee = baseFee + priorityFee;

    return {
      baseFee: baseFee / LAMPORTS_PER_SOL,
      priorityFee: priorityFee / LAMPORTS_PER_SOL,
      totalFee: totalFee / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    console.warn('Failed to estimate transaction fee, using default');
    return {
      baseFee: 0.000005,
      priorityFee: 0,
      totalFee: 0.000005,
    };
  }
};

export const validateSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const formatSolAmount = (amount: number, decimals: number = 4): string => {
  return amount.toFixed(decimals);
};

export const lamportsToSol = (lamports: number): number => {
  return lamports / LAMPORTS_PER_SOL;
};

export const solToLamports = (sol: number): number => {
  return Math.floor(sol * LAMPORTS_PER_SOL);
};

export const getExplorerUrl = (signature: string, network: string): string => {
  const cluster = network.includes('devnet') ? 'devnet' : 
                 network.includes('testnet') ? 'testnet' : '';

  const clusterParam = cluster ? `?cluster=${cluster}` : '';
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
};