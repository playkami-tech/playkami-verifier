'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVerifier } from '@/providers/VerifierProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function VerificationInput() {
  const { packId } = useVerifier();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Pack Opening</CardTitle>
        <CardDescription>
          Verification results will appear here after selecting a pack from the Pack History table
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!packId ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">How to verify a pack:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to the <strong>Pack History</strong> tab</li>
                <li>Enter your wallet address to view your packs</li>
                <li>Click <strong>Verify</strong> on any pack to run the verification</li>
              </ol>
              <p className="text-xs mt-3 text-muted-foreground">
                For security, you can only verify packs by providing your wallet address. Direct pack ID lookup is disabled.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Verifying Pack #{packId}... Results will appear below.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
