
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

// Attempt to import the ABI from the contracts directory
// The user needs to ensure this file exists and contains the correct ABI
import FruitFlowEscrowABIFile from '@/contracts/FruitFlowEscrow.json';

const contractAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;
// Enhanced logging to make it very clear what address is being used.
console.log('%c[ethersService] Environment Variable NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS: ' + contractAddress, 'color: blue; font-weight: bold; font-size: 14px;');

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

export async function getEscrowContract(signer?: ethers.Signer | null): Promise<ethers.Contract | null> {
  let currentSigner = signer;
  if (!currentSigner) {
    try {
      const { signer: newSigner } = await getSignerAndProvider();
      currentSigner = newSigner;
    } catch (error) {
      // If getSignerAndProvider throws (e.g., Metamask not installed/connected),
      // we can't proceed to create a contract instance.
      return null;
    }
  }

  // Critical check: Log the address actually being used by this function.
  console.log('%c[ethersService] getEscrowContract is using contract address: ' + contractAddress, 'color: green; font-weight: bold; font-size: 14px;');

  if (!contractAddress) {
    const errorMessage = "Escrow contract address is NOT CONFIGURED. Please ensure NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS is set in your .env file and the server is restarted.";
    toast({ title: "CRITICAL Contract Error", description: errorMessage, variant: "destructive", duration: 10000 });
    console.error('%c' + errorMessage, 'color: red; font-weight: bold; font-size: 16px;');
    return null;
  }
  if (!FruitFlowEscrowABI || FruitFlowEscrowABI.length === 0) {
    toast({ title: "Contract Error", description: "Escrow contract ABI is not loaded. Ensure src/contracts/FruitFlowEscrow.json exists and is correctly populated.", variant: "destructive", duration: 7000 });
    console.error('[ethersService] FruitFlowEscrowABI is not loaded or is empty.');
    return null;
  }
  
  console.log('[ethersService] Instantiating contract with address:', contractAddress);
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
