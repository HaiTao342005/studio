
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { projectHealthCheck, type ProjectHealthCheckOutput } from '@/ai/flows/project-health-check-flow';
import { Loader2, AlertTriangle, ShieldCheck, Activity, ListChecks, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/badge';

export function AIProjectMonitor() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [healthResult, setHealthResult] = useState<ProjectHealthCheckOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckHealth = async () => {
    setIsLoading(true);
    setError(null);
    setHealthResult(null);
    try {
      const result = await projectHealthCheck();
      setHealthResult(result);
    } catch (err) {
      console.error("Project health check failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during health check.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string | undefined): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return "outline";
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('nominal')) return 'default'; // Often green
    if (lowerStatus.includes('minor concerns')) return 'outline'; // Often yellow/orange
    if (lowerStatus.includes('action required')) return 'destructive'; // Often red
    return 'secondary';
  };
  
  const getStatusIcon = (status: string | undefined) => {
    if (!status) return <Activity className="h-5 w-5" />;
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('nominal')) return <ShieldCheck className="h-5 w-5 text-green-500" />;
    if (lowerStatus.includes('minor concerns')) return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    if (lowerStatus.includes('action required')) return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return <Activity className="h-5 w-5" />;
  };


  return (
    <Card className="shadow-lg col-span-1 md:col-span-2 lg:col-span-3"> {/* Allow to span full width */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            AI Project Health Monitor
          </CardTitle>
          <Button onClick={handleCheckHealth} disabled={isLoading} size="sm">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ListChecks className="mr-2 h-4 w-4" />
            )}
            Run Health Check
          </Button>
        </div>
        <CardDescription>
          Get an AI-powered overview of potential issues or areas of concern within the FruitFlow platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-muted-foreground">Checking project health...</p>
          </div>
        )}
        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Health Check Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && !healthResult && (
          <p className="text-muted-foreground text-center py-8">
            Click "Run Health Check" to get the latest AI assessment.
          </p>
        )}
        {healthResult && !isLoading && !error && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg border gap-4 bg-card">
                <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">Overall Status</p>
                    <p className="text-3xl font-bold text-primary flex items-center gap-2">
                        {getStatusIcon(healthResult.overallStatus)}
                        {healthResult.overallStatus}
                    </p>
                </div>
                <Badge variant={getStatusBadgeVariant(healthResult.overallStatus)} className="text-md px-3 py-1">
                    {healthResult.overallStatus}
                </Badge>
            </div>

            {healthResult.warnings && healthResult.warnings.length > 0 && (
              <div>
                <h3 className="font-semibold text-xl mb-2 text-destructive">Warnings:</h3>
                <ul className="list-disc space-y-2 pl-5 bg-destructive/10 p-4 rounded-md border border-destructive/30">
                  {healthResult.warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-destructive-foreground/90">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {healthResult.warnings && healthResult.warnings.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-6 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mb-3" />
                    <p className="text-lg font-semibold text-muted-foreground">No significant issues detected.</p>
                    <p className="text-sm text-muted-foreground">The platform appears to be operating nominally based on the AI's hypothetical review.</p>
                </div>
            )}
          </div>
        )}
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground">
            Note: This health check is based on a simulated AI review. For critical issues, always perform manual checks and detailed analysis.
        </p>
      </CardFooter>
    </Card>
  );
}
