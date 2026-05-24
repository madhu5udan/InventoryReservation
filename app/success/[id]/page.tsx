'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SuccessPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <CardTitle>Order Confirmed!</CardTitle>
          <CardDescription>
            Your reservation has been confirmed and stock has been reserved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Reservation ID</p>
            <p className="font-mono text-sm break-all">{params.id}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your order has been confirmed. The stock has been permanently reduced from inventory.
            </p>
            <p className="text-sm text-muted-foreground">
              You can now proceed with payment or shipment processing.
            </p>
          </div>

          <Link href="/">
            <Button className="w-full">Back to Products</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
