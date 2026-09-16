import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, RefreshCw } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { toast } from '../components/Toast';
import { Product, formatMoney, formatWeight, formatDate, formatDateTime } from '../lib/types';
import { Card, Loading, Badge, Modal, ConfirmDialog } from '../components/ui';
import { ProductForm } from './Inventory';

export default function ProductDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(searchParams.get('edit') === '1');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, refreshKey]);

  const handleDelete = async () => {
    try {
      await api.delete(`/products/${id}`);
      toast.success('Item moved to trash');
      navigate('/inventory');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (loading) return <Loading text="Loading item..." />;
  if (!product) return null;

  const currentRate = 7400;
  const currentValue = product.netWeight * currentRate;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <Badge status={product.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card title="Item Details">
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Item Code</span><span className="font-medium">{product.itemCode}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Barcode</span><span className="font-medium">{product.barcode || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">HUID</span><span className="font-medium">{product.huid || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="font-medium">{product.category?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Metal</span><span className="font-medium">{product.metal}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Purity</span><span className="font-medium">{product.purity === 100 ? 'Fine' : `${product.purity}K`} ({product.fineness.toFixed(3)})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Hallmark</span><span className="font-medium">{product.hallmark ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Stone Type</span><span className="font-medium">{product.stoneType || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Supplier</span><span className="font-medium">{product.supplier?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Purchase Date</span><span className="font-medium">{product.purchaseDate ? formatDate(product.purchaseDate) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium">{formatDateTime(product.createdAt)}</span></div>
            </div>
            {product.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{product.notes}</div>
            )}
          </Card>

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setEditOpen(true)}><Edit size={16} /> Edit</button>
            <button className="btn-danger flex-1" onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Delete</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><div className="text-center"><div className="text-xl font-bold">{formatWeight(product.grossWeight)}</div><div className="text-xs text-gray-400">Gross Weight</div></div></Card>
            <Card><div className="text-center"><div className="text-xl font-bold">{formatWeight(product.netWeight)}</div><div className="text-xs text-gray-400">Net Weight</div></div></Card>
            <Card><div className="text-center"><div className="text-xl font-bold">{formatWeight(product.fineGoldWeight)}</div><div className="text-xs text-gray-400">Fine Weight</div></div></Card>
            <Card><div className="text-center"><div className="text-xl font-bold">{product.purchaseCost != null ? formatMoney(product.purchaseCost) : '-'}</div><div className="text-xs text-gray-400">Cost</div></div></Card>
          </div>

          <Card title="Valuation (at current rate)">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Metal Value (net × rate)</span><span>{formatMoney(currentValue)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Making Charge</span><span>{formatMoney(product.makingCharge)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Wastage ({product.wastagePercent}%)</span><span>{formatMoney(currentValue * (product.wastagePercent / 100))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Stone Charge</span><span>{formatMoney(product.stoneCharge)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Selling Price</span><span className="font-semibold">{product.sellingPrice != null ? formatMoney(product.sellingPrice) : '-'}</span></div>
            </div>
          </Card>

          <Card title="Stock Movements">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Weight</th>
                    <th className="table-header">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {product.stockMovements?.map((m: any) => (
                    <tr key={m.id}>
                      <td className="table-cell">{formatDateTime(m.createdAt)}</td>
                      <td className="table-cell"><Badge status={m.movementType} /></td>
                      <td className="table-cell font-medium">{m.weight > 0 ? '+' : ''}{formatWeight(m.weight)}</td>
                      <td className="table-cell text-gray-500">{m.notes || '-'}</td>
                    </tr>
                  ))}
                  {(!product.stockMovements || product.stockMovements.length === 0) && (
                    <tr><td colSpan={4} className="table-cell text-center text-gray-400">No movements recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {product.saleItems?.length > 0 && (
            <Card title="Sale History">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Invoice</th>
                      <th className="table-header">Date</th>
                      <th className="table-header text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.saleItems.map((si: any) => (
                      <tr key={si.id}>
                        <td className="table-cell">
                          <Link to={`/invoices/${si.saleId}`} className="text-gold-dark hover:underline">{si.sale?.invoiceNumber}</Link>
                        </td>
                        <td className="table-cell">{formatDate(si.sale?.createdAt)}</td>
                        <td className="table-cell text-right">{formatMoney(si.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {editOpen && (
        <ProductForm
          productId={product.id}
          onDone={() => {
            setEditOpen(false);
            setRefreshKey((k) => k + 1);
            toast.success('Item updated');
          }}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this item?"
        message={`"${product.name}" (${product.itemCode}) will be moved to trash.`}
        confirmText="Delete"
      />
    </div>
  );
}