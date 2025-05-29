
'use server';
/**
 * @fileOverview An AI flow to perform a general health check of the FruitFlow project.
 *
 * - projectHealthCheck - A function that simulates a project health assessment.
 * - ProjectHealthCheckOutput - The return type for the projectHealthCheck function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProjectHealthCheckOutputSchema = z.object({
  warnings: z.array(z.string()).describe("A list of potential issues or warnings for the manager based on a hypothetical review of recent platform activity. Examples: unusual transaction patterns, payment delays, concentration risks."),
  overallStatus: z.string().describe("A brief summary of project health, e.g., 'Nominal', 'Minor Concerns', 'Action Required'."),
});
export type ProjectHealthCheckOutput = z.infer<typeof ProjectHealthCheckOutputSchema>;

export async function projectHealthCheck(): Promise<ProjectHealthCheckOutput> {
  return projectHealthCheckFlow({});
}

const prompt = ai.definePrompt({
  name: 'projectHealthCheckPrompt',
  input: {schema: z.object({})}, // No specific input for this general check
  output: {schema: ProjectHealthCheckOutputSchema},
  prompt: `You are an AI assistant responsible for monitoring the FruitFlow trading platform.
  Your task is to provide a general project health check summary for the platform manager.

  Based on a HYPOTHETICAL review of recent (simulated) platform activity, please identify potential issues or areas of concern.
  Consider the following types of potential issues:
  - A sudden surge in high-value orders from new, unverified customers.
  - An unusual number of orders remaining in 'Awaiting Payment' status for longer than typical.
  - Concentration risk, such as a high percentage of transactions involving a single customer country known for payment instability.
  - Potential discrepancies in order data compared to typical market behavior (e.g., significantly unusual fruit prices or quantities).
  - A pattern of failed payment simulations.

  Generate a list of 1 to 3 concise warnings if such hypothetical issues are identified.
  If no significant issues are apparent from this hypothetical review, state that the project health is nominal and provide an empty array for warnings.
  Provide an overall status (e.g., 'Nominal', 'Minor Concerns', 'Action Required').
  Ensure the warnings are actionable or highlight specific areas for the manager to investigate.`,
});

const projectHealthCheckFlow = ai.defineFlow(
  {
    name: 'projectHealthCheckFlow',
    inputSchema: z.object({}),
    outputSchema: ProjectHealthCheckOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
