'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  name: string;
  sku: string;
  inventories: Array<{
    warehouseId: string;
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  }>;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export default function ReservePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const warehouseId = searchParams.get('warehouseId');

  const [product, setProduct] = useState<Product | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsRes, warehousesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/warehouses'),
        ]);

        if (!productsRes.ok || !warehousesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

        const foundProduct = productsData.data.find((p: Product) => p.id === params.id);
        const foundWarehouse = warehousesData.data.find(
          (w: Warehouse) => w.id === warehouseId
        );

        if (!foundProduct || !foundWarehouse) {
          throw new Error('Product or warehouse not found');
        }

        setProduct(foundProduct);
        setWarehouse(foundWarehouse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, warehouseId]);

  const handleReserve = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          productId: params.id,
          warehouseId,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError('Out of stock! Another customer may have reserved the items.');
          return;
        }
        throw new Error(data.error?.message || 'Failed to create reservation');
      }

      // Save reservation to localStorage for checkout page
      localStorage.setItem(
        `reservation-${data.data.reservation.id}`,
        JSON.stringify(data.data.reservation)
      );

      // Navigate to checkout with reservation ID
      router.push(`/checkout/${data.data.reservation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!product || !warehouse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error || 'Product or warehouse not found'}</CardDescription>
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

  const inventory = product.inventories.find((i) => i.warehouseId === warehouseId);
  const maxQuantity = inventory?.availableStock || 0;
  const isOutOfStock = maxQuantity <= 0;

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-primary hover:underline mb-6 block">
          ← Back to Products
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>SKU: {product.sku}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Warehouse Info */}
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Warehouse</h3>
              <p>{warehouse.name}</p>
              <p className="text-sm text-muted-foreground">{warehouse.location}</p>
            </div>

            {/* Stock Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Stock</p>
                <p className="text-2xl font-bold">{inventory?.totalStock}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Reserved</p>
                <p className="text-2xl font-bold">{inventory?.reservedStock}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Available</p>
                <p className={`text-2xl font-bold ${isOutOfStock ? 'text-destructive' : ''}`}>
                  {inventory?.availableStock}
                </p>
              </div>
            </div>

            {/* Quantity Selection */}
            {!isOutOfStock && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded border hover:bg-muted"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="flex-1 px-3 py-2 border rounded text-center"
                    min="1"
                    max={maxQuantity}
                  />
                  <button
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    className="w-10 h-10 rounded border hover:bg-muted"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum: {maxQuantity} units
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleReserve}
                disabled={isOutOfStock || submitting}
                className="flex-1"
              >
                {submitting ? 'Creating Reservation...' : 'Reserve Now'}
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>

            {isOutOfStock && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
                This product is out of stock at this warehouse.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
