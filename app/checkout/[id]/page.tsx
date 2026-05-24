'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const reservationId = params.id;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch reservation from API
        const reservationRes = await fetch(`/api/reservations/${reservationId}`);

        if (!reservationRes.ok) {
          throw new Error('Reservation not found');
        }

        const reservationData = await reservationRes.json();
        const res = reservationData.data;

        // Fetch products and warehouses
        const [productsRes, warehousesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/warehouses'),
        ]);

        if (!productsRes.ok || !warehousesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

        const foundProduct = productsData.data.find((p: Product) => p.id === res.productId);
        const foundWarehouse = warehousesData.data.find((w: Warehouse) => w.id === res.warehouseId);

        setReservation(res);
        setProduct(foundProduct);
        setWarehouse(foundWarehouse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reservation');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reservationId]);

  // Countdown timer
  useEffect(() => {
    if (!reservation) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiresAt = new Date(reservation.expiresAt).getTime();
      const remaining = Math.max(0, expiresAt - now);
      setTimeLeft(remaining);

      if (remaining === 0) {
        setError('Reservation expired! Please create a new reservation.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      setError(null);

      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setError('Reservation expired! Please create a new reservation.');
          return;
        }
        throw new Error(data.error?.message || 'Failed to confirm reservation');
      }

      // Show success and redirect
      router.push(`/success/${reservationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm reservation');
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    try {
      setReleasing(true);
      setError(null);

      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to release reservation');
      }

      // Redirect back to products
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release reservation');
    } finally {
      setReleasing(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!reservation || !product || !warehouse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || 'Reservation not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Back to Products</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = timeLeft === 0;

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-primary hover:underline mb-6 block">
          ← Back to Products
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Order Review</CardTitle>
            <CardDescription>Reservation ID: {reservationId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Expiration Timer */}
            <div className={`p-4 rounded-lg ${isExpired ? 'bg-destructive/10 border border-destructive' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm font-medium ${isExpired ? 'text-destructive' : 'text-blue-900'}`}>
                Reservation Expires In
              </p>
              <p className={`text-3xl font-bold ${isExpired ? 'text-destructive' : 'text-blue-900'}`}>
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </p>
              {isExpired && (
                <p className="text-sm text-destructive mt-2">
                  Your reservation has expired. Please create a new one.
                </p>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-2">
              <h3 className="font-semibold">Product</h3>
              <p>{product.name}</p>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            </div>

            {/* Warehouse Details */}
            <div className="space-y-2">
              <h3 className="font-semibold">Warehouse</h3>
              <p>{warehouse.name}</p>
              <p className="text-sm text-muted-foreground">{warehouse.location}</p>
            </div>

            {/* Quantity */}
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
              <span>Quantity</span>
              <Badge>{reservation.quantity} unit{reservation.quantity > 1 ? 's' : ''}</Badge>
            </div>

            {/* Status */}
            <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
              <span>Status</span>
              <Badge variant="secondary">{reservation.status}</Badge>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleConfirm}
                disabled={isExpired || confirming}
                className="flex-1"
              >
                {confirming ? 'Confirming...' : 'Confirm Order'}
              </Button>
              <Button
                onClick={handleRelease}
                variant="outline"
                disabled={releasing}
                className="flex-1"
              >
                {releasing ? 'Releasing...' : 'Cancel Reservation'}
              </Button>
            </div>

            {/* Info */}
            <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
              <p>
                Confirming this order will permanently reduce the stock and complete your purchase.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
