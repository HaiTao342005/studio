

import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

// Attempt to import the ABI from the contracts directory
// The user needs to ensure this file exists and contains the correct ABI
import FruitFlowEscrowABIFile from '@/contracts/FruitFlowEscrow.json'; 

const contractAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;
const FruitFlowEscrowABI = FruitFlowEscrowABIFile.abi; // Assuming the ABI array is directly under the 'abi' key

export async function getSignerAndProvider() {
  if (typeof window.ethereum === 'undefined') {
    toast({ title: "Metamask Not Found", description: "Please install Metamask to interact with the blockchain.", variant: "destructive" });
    throw new Error('Metamask is not installed.');
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  // Request accounts every time to ensure the user is prompted if not connected
  // or if accounts have changed.
  try {
    await provider.send("eth_requestAccounts", []); 
  } catch (error: any) {
    // Handle cases where user rejects connection or Metamask is locked
    toast({ title: "Metamask Connection Required", description: error.message || "Please connect/unlock Metamask to proceed.", variant: "destructive" });
    throw new Error(error.message || 'Metamask connection rejected or failed.');
  }
  const signer = await provider.getSigner();
  return { signer, provider };
}

export async function getEscrowContract(signer?: ethers.Signer | null) {
  let currentSigner = signer;
  if (!currentSigner) {
    const { signer: newSigner } = await getSignerAndProvider();
    currentSigner = newSigner;
  }

  if (!contractAddress) {
    toast({ title: "Contract Error", description: "Escrow contract address is not configured. Please set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS in your .env.local file.", variant: "destructive", duration: 7000 });
    throw new Error('Escrow contract address not configured.');
  }
  if (!FruitFlowEscrowABI || FruitFlowEscrowABI.length === 0) {
    toast({ title: "Contract Error", description: "Escrow contract ABI is not loaded. Ensure src/contracts/FruitFlowEscrow.json exists and is correctly populated.", variant: "destructive", duration: 7000 });
    throw new Error('Escrow contract ABI not loaded or is empty.');
  }

  return new ethers.Contract(contractAddress, FruitFlowEscrowABI, currentSigner);
}

/**
 * Converts a string (like a Firestore ID) to a bytes32 string suitable for the smart contract.
 * Uses keccak256 hash.
 * @param stringId The string ID.
 * @returns A bytes32 hex string.
 */
export function convertToBytes32(stringId: string): string {
  return ethers.id(stringId); // ethers.id() computes the keccak256 hash
}

// Helper to parse BigInt to number, for amounts from contract if needed (with caution for large numbers)
export function parseBigIntToNumber(value: any): number {
    if (typeof value === 'bigint') {
        // Be cautious with large numbers, JavaScript numbers can lose precision.
        // For display purposes, it might be okay. For calculations, prefer BigInt.
        return Number(value);
    }
    return value;
}

// Helper to get current connected ETH address
export async function getCurrentWalletAddress(): Promise<string | null> {
    if (typeof window.ethereum === 'undefined') {
        return null;
    }
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        return accounts.length > 0 ? accounts[0].address : null;
    } catch (error) {
        console.error("Error fetching current wallet address:", error);
        return null;
    }
}

