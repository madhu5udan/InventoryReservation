'use client';

import { useEffect, useState } from 'react';
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

interface PendingReservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  product: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    name: string;
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsRes, warehousesRes, reservationsRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/warehouses'),
          fetch('/api/reservations'),
        ]);

        if (!productsRes.ok || !warehousesRes.ok || !reservationsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();
        const reservationsData = await reservationsRes.json();

        setProducts(productsData.data || []);
        setWarehouses(warehousesData.data || []);
        setPendingReservations(reservationsData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatTimeLeft = (expiresAt: string): string => {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const remaining = Math.max(0, expiry - now);
    
    const minutes = Math.floor((remaining / 1000 / 60) % 60);
    const seconds = Math.floor((remaining / 1000) % 60);
    
    if (remaining === 0) return 'Expired';
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Inventory Reservation System</h1>
        <p className="text-muted-foreground">
          Select a product and warehouse to make a reservation
        </p>
      </div>

      {/* Pending Reservations Section */}
      {pendingReservations.length > 0 && (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Pending Reservations</CardTitle>
            <CardDescription className="text-amber-800">
              Resume your checkout or your reservation will expire
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{reservation.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.quantity} unit(s) at {reservation.warehouse.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Expires in</p>
                      <p className="font-mono text-sm font-semibold text-amber-600">
                        {formatTimeLeft(reservation.expiresAt)}
                      </p>
                    </div>
                    <Link href={`/checkout/${reservation.id}`}>
                      <Button size="sm" variant="default">
                        Resume Checkout
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription>SKU: {product.sku}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Warehouse</th>
                        <th className="px-4 py-2 text-right">Total Stock</th>
                        <th className="px-4 py-2 text-right">Reserved</th>
                        <th className="px-4 py-2 text-right">Available</th>
                        <th className="px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.inventories.map((inventory) => {
                        const warehouse = warehouses.find(
                          (w) => w.id === inventory.warehouseId
                        );
                        const isOutOfStock = inventory.availableStock <= 0;

                        return (
                          <tr key={inventory.warehouseId} className="border-t">
                            <td className="px-4 py-2">{warehouse?.name}</td>
                            <td className="px-4 py-2 text-right">{inventory.totalStock}</td>
                            <td className="px-4 py-2 text-right">
                              {inventory.reservedStock > 0 ? (
                                <Badge variant="secondary">{inventory.reservedStock}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <span
                                className={
                                  isOutOfStock
                                    ? 'text-destructive font-semibold'
                                    : 'font-semibold'
                                }
                              >
                                {inventory.availableStock}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <Link
                                href={`/products/${product.id}/reserve?warehouseId=${inventory.warehouseId}`}
                              >
                                <Button
                                  size="sm"
                                  disabled={isOutOfStock}
                                >
                                  Reserve
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No products found</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
