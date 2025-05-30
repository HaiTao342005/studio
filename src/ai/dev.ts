
import { config } from 'dotenv';
config();

// Keep the original import path if the filename itself doesn't change,
// or update if payment-risk-assessment.ts is renamed (e.g., to customer-payment-risk.ts)
import '@/ai/flows/payment-risk-assessment.ts';
import '@/ai/flows/project-health-check-flow.ts'; // Added new flow
import '@/ai/flows/calculate-distance-flow.ts'; // Added new flow for distance calculation
