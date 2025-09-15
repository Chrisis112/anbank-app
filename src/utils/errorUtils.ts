// utils/errorUtils.ts
/**
 * Error handling utilities for Phantom wallet integration
 */

export interface WalletError {
  code: string;
  message: string;
  userMessage: string;
}

export const parseWalletError = (error: any): WalletError => {
  // Default error
  let walletError: WalletError = {
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'An unknown error occurred',
    userMessage: 'Something went wrong. Please try again.'
  };

  if (!error) return walletError;

  // Phantom-specific errors
  if (error.code === 4001 || error.message?.includes('User rejected')) {
    return {
      code: 'USER_REJECTED',
      message: error.message,
      userMessage: 'Transaction was cancelled by user.'
    };
  }

  if (error.code === -32003) {
    return {
      code: 'UNAUTHORIZED',
      message: error.message,
      userMessage: 'Wallet not connected. Please connect your wallet first.'
    };
  }

  // Network errors
  if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: error.message,
      userMessage: 'Network error. Please check your internet connection and try again.'
    };
  }

  // Insufficient funds
  if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message: error.message,
      userMessage: 'Insufficient balance to complete this transaction.'
    };
  }

  // Transaction failed
  if (error.message?.includes('Transaction simulation failed')) {
    return {
      code: 'SIMULATION_FAILED',
      message: error.message,
      userMessage: 'Transaction failed. Please check the transaction details and try again.'
    };
  }

  // Phantom not installed
  if (error.message?.includes('phantom') || error.code === 'PHANTOM_NOT_FOUND') {
    return {
      code: 'PHANTOM_NOT_FOUND',
      message: error.message,
      userMessage: 'Phantom wallet not found. Please install Phantom wallet to continue.'
    };
  }

  return walletError;
};

export const formatTransactionError = (signature: string | null, error: any): string => {
  if (signature) {
    return `Transaction ${signature} failed: ${parseWalletError(error).userMessage}`;
  }
  return parseWalletError(error).userMessage;
};