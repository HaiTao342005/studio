
import { ethers } from 'ethers';
import { toast } from '@/hooks/use-toast';

// IMPORTANT: Replace this with the actual ABI from your compiled smart contract
// You would typically import this from a JSON file:
// import FruitFlowEscrowABIFile from '@/contracts/FruitFlowEscrow.json';
// const FruitFlowEscrowABI = FruitFlowEscrowABIFile.abi;
const PLACEHOLDER_ABI = [
  "event OrderCreated(bytes32 indexed orderId, address indexed customer, address indexed supplier, uint256 totalAmount)",
  "event OrderFunded(bytes32 indexed orderId, address indexed customer, uint256 amount)",
  "event DeliveryConfirmed(bytes32 indexed orderId, address indexed customer)",
  "event PayoutsMade(bytes32 indexed orderId, address indexed supplier, uint256 supplierAmount, address indexed transporter, uint256 transporterAmount)",
  "event OrderDisputed(bytes32 indexed orderId, address indexed customer)",
  "function orders(bytes32) view returns (address customer, address supplier, address transporter, uint256 productAmount, uint256 shippingFee, uint256 totalAmount, uint8 status, address token)",
  "function createOrder(bytes32 orderId, address customer, address supplier, address transporter, uint256 productAmount, uint256 shippingFee, address token) external",
  "function fundOrder(bytes32 orderId) external payable",
  "function confirmDelivery(bytes32 orderId) external",
  "function disputeOrder(bytes32 orderId) external",
  "function resolveDispute(bytes32 orderId, bool refundCustomer) external",
  "function getOrder(bytes32 orderId) external view returns (address, address, address, uint256, uint256, uint256, uint8, address)",
  "receive() external payable"
]; // THIS IS A VERY SIMPLIFIED PLACEHOLDER ABI. USE YOUR ACTUAL ABI.

const contractAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;

export async function getSignerAndProvider() {
  if (typeof window.ethereum === 'undefined') {
    toast({ title: "Metamask Not Found", description: "Please install Metamask to interact with the blockchain.", variant: "destructive" });
    throw new Error('Metamask is not installed.');
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
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
    toast({ title: "Contract Error", description: "Escrow contract address is not configured. Please set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS.", variant: "destructive", duration: 7000 });
    throw new Error('Escrow contract address not configured.');
  }
  if (!PLACEHOLDER_ABI || PLACEHOLDER_ABI.length === 0) {
    toast({ title: "Contract Error", description: "Escrow contract ABI is not loaded. Check src/lib/ethersService.ts and src/contracts/", variant: "destructive", duration: 7000 });
    throw new Error('Escrow contract ABI not loaded.');
  }

  return new ethers.Contract(contractAddress, PLACEHOLDER_ABI /* Replace with your actual ABI */, currentSigner);
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
        return Number(value);
    }
    return value;
}
