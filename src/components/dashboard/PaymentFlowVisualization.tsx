"use client";

import { Users, Landmark, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FlowPartyProps {
  name: string;
  type: 'Importer' | 'Exporter' | 'Bank';
  Icon: React.ElementType;
}

const FlowParty = ({ name, type, Icon }: FlowPartyProps) => (
  <div className="flex flex-col items-center p-4 border rounded-lg shadow-sm bg-card w-48 min-h-[120px] justify-center">
    <Icon className="h-10 w-10 mb-2 text-primary" />
    <p className="font-semibold text-center">{name}</p>
    <p className="text-xs text-muted-foreground">{type}</p>
  </div>
);

const FlowArrow = () => (
  <div className="flex items-center justify-center mx-2 md:mx-4">
    <ArrowRight className="h-8 w-8 text-gray-400" />
  </div>
);


export function PaymentFlowVisualization() {
  // Example data, can be customized or made dynamic
  const importerName = "Global Fruits Inc.";
  const exporterName = "Tropical Exports Co.";
  const importerBank = "City Bank";
  const exporterBank = "National Trade Bank";

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Typical Payment Flow</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-2 overflow-x-auto py-8">
        <FlowParty name={importerName} type="Importer" Icon={Users} />
        <FlowArrow />
        <FlowParty name={importerBank} type="Bank" Icon={Landmark} />
        <FlowArrow />
        <FlowParty name={exporterBank} type="Bank" Icon={Landmark} />
        <FlowArrow />
        <FlowParty name={exporterName} type="Exporter" Icon={Users} />
      </CardContent>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center">
          This diagram illustrates a common international payment flow involving correspondent banks. Actual flows may vary.
        </p>
      </CardContent>
    </Card>
  );
}
