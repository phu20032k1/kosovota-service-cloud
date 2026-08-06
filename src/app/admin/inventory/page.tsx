"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readApiResponse } from "@/lib/client-api";

type Item = { id: string; sku: string; name: string; category: string; unit: string; minStock: number; costPrice: number; salePrice: number };
type Balance = { id: string; quantity: number; reserved: number; item: Item };
type Warehouse = { id: string; code: string; name: string; type: string; balances: Balance[]; dealer?: { dealerCode: string; name: string } | null };
type DealerOption = { id: string; dealerCode: string; name: string; province?: string | null };
type Movement = { id: string; movementCode: string; type: string; quantity: number; unitCost: number; createdAt: string; item: Item; fromWarehouse?: { name: string } | null; toWarehouse?: { name: string } | null };
type Data = { items: Item[]; warehouses: Warehouse[]; movements: Movement[]; dealers: DealerOption[]; totals: { quantity: number; reserved: number; value: number; lowStock: number } };
type Modal = "ITEM" | "WAREHOUSE" | "MOVE" | null;
type MoveType = "IN" | "OUT" | "TRANSFER" | "ADJUST_IN" | "ADJUST_OUT";

const money = (value = 0) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const warehouseType = (value: string) => value === "CENTRAL" ? "Kho tổng" : value === "REGIONAL" ? "Kho khu vực" : value === "DEALER" ? "Kho đại lý" : value;

const initialItemForm = { sku: "", name: "", category: "Lõi lọc", unit: "cái", minStock: "5", costPrice: "0", salePrice: "0" };
const initialWarehouseForm = { code: "", name: "", type: "CENTRAL", dealerId: "", province: "", address: "" };
const initialMoveForm: { type: MoveType; itemId: string; fromWarehouseId: string; toWarehouseId: string; quantity: string; unitCost: string; note: string } = {
  type: "IN", itemId: "", fromWarehouseId: "", toWarehouseId: "", quantity: "1", unitCost: "0", note: "",
};

export default function InventoryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [warehouseForm, setWarehouseForm] = useState(initialWarehouseForm);
  const [moveForm, setMoveForm] = useState(initialMoveForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const result = await readApiResponse<Data>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được kho.");
      setData(result.data);
      setMoveForm((current) => current.itemId || !result.data?.items[0] ? current : { ...current, itemId: result.data.items[0].id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được kho.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const balances = useMemo(() => data?.warehouses.flatMap((warehouse) => warehouse.balances.map((balance) => ({ ...balance, warehouse }))) || [], [data]);
  const needsFrom = ["OUT", "TRANSFER", "ADJUST_OUT"].includes(moveForm.type);
  const needsTo = ["IN", "TRANSFER", "ADJUST_IN"].includes(moveForm.type);

  const sourceWarehouses = useMemo(() => {
    if (!data || !moveForm.itemId) return [];
    return data.warehouses.filter((warehouse) => {
      const balance = warehouse.balances.find((row) => row.item.id === moveForm.itemId);
      return Boolean(balance && balance.quantity - balance.reserved > 0);
    });
  }, [data, moveForm.itemId]);

  const selectedSource = balances.find((balance) => balance.warehouse.id === moveForm.fromWarehouseId && balance.item.id === moveForm.itemId);
  const selectedAvailable = selectedSource ? Math.max(0, selectedSource.quantity - selectedSource.reserved) : 0;
  const quantity = Math.round(Number(moveForm.quantity));
  const quantityInvalid = !Number.isFinite(quantity) || quantity <= 0;
  const insufficient = needsFrom && (!selectedSource || quantity > selectedAvailable);
  const sameWarehouse = moveForm.type === "TRANSFER" && Boolean(moveForm.fromWarehouseId) && moveForm.fromWarehouseId === moveForm.toWarehouseId;

  useEffect(() => {
    if (!needsFrom || !moveForm.fromWarehouseId) return;
    if (!sourceWarehouses.some((warehouse) => warehouse.id === moveForm.fromWarehouseId)) {
      setMoveForm((current) => ({ ...current, fromWarehouseId: "" }));
    }
  }, [needsFrom, moveForm.fromWarehouseId, sourceWarehouses]);

  function openModal(next: Exclude<Modal, null>) {
    setError("");
    setMessage("");
    if (next === "MOVE" && data) {
      setMoveForm((current) => ({ ...current, itemId: current.itemId || data.items[0]?.id || "" }));
    }
    setModal(next);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setError("");
  }

  function changeMoveType(type: MoveType) {
    setError("");
    setMoveForm((current) => ({
      ...current,
      type,
      fromWarehouseId: ["IN", "ADJUST_IN"].includes(type) ? "" : current.fromWarehouseId,
      toWarehouseId: ["OUT", "ADJUST_OUT"].includes(type) ? "" : current.toWarehouseId,
    }));
  }

  function changeItem(itemId: string) {
    const item = data?.items.find((row) => row.id === itemId);
    setMoveForm((current) => ({ ...current, itemId, fromWarehouseId: "", unitCost: current.type === "IN" && item ? String(item.costPrice || 0) : current.unitCost }));
    setError("");
  }

  async function submit(action: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const result = await readApiResponse(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Thao tác kho thất bại.");
      setMessage(result.message || "Đã cập nhật kho.");
      setModal(null);
      if (action === "CREATE_ITEM") setItemForm(initialItemForm);
      if (action === "CREATE_WAREHOUSE") setWarehouseForm(initialWarehouseForm);
      if (action === "MOVE_STOCK") setMoveForm((current) => ({ ...initialMoveForm, itemId: current.itemId }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Thao tác kho thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCatalog(action: "DELETE_ITEM" | "DELETE_WAREHOUSE", id: string, label: string) {
    if (busy) return;
    const confirmed = window.confirm(`Xóa “${label}”? Nếu đã có lịch sử giao dịch, hệ thống sẽ ngừng sử dụng thay vì xóa lịch sử.`);
    if (!confirmed) return;
    const payload = action === "DELETE_ITEM" ? { itemId: id } : { warehouseId: id };
    await submit(action, payload);
  }

  function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!moveForm.itemId) return setError("Chưa có vật tư để lập phiếu.");
    if (quantityInvalid) return setError("Số lượng phải lớn hơn 0.");
    if (needsFrom && !moveForm.fromWarehouseId) return setError(sourceWarehouses.length ? "Hãy chọn kho xuất." : "Không có kho nào còn vật tư này để xuất.");
    if (needsTo && !moveForm.toWarehouseId) return setError("Hãy chọn kho nhận.");
    if (sameWarehouse) return setError("Kho xuất và kho nhận phải khác nhau.");
    if (insufficient) return setError(`Tồn khả dụng chỉ còn ${selectedAvailable}.`);
    void submit("MOVE_STOCK", moveForm);
  }

  return (
    <main className="min-h-screen">
      <OperationsHeader title="Kho vật tư" subtitle="Quản lý danh mục vật tư, kho, tồn và lịch sử nhập xuất" actions={<button type="button" onClick={() => void load()} disabled={loading || busy} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>} />
      <div className="page-container space-y-6">
        {message && <Notice kind="success">{message}</Notice>}
        {error && !modal && <Notice kind="error">{error}</Notice>}
        {loading && !data ? <LoadingState label="Đang tải dữ liệu kho..."/> : data && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Tổng tồn" value={data.totals.quantity} icon="package" tone="emerald"/>
            <MetricCard label="Đang giữ chỗ" value={data.totals.reserved} icon="lock" tone="blue"/>
            <MetricCard label="Giá trị tồn" value={money(data.totals.value)} icon="wallet" tone="violet"/>
            <MetricCard label="Cảnh báo thấp" value={data.totals.lowStock} icon="alert" tone="rose"/>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="surface-card overflow-hidden">
              <div className="data-toolbar">
                <div><h2 className="page-section-title">Danh mục vật tư</h2><p className="page-section-subtitle">Tất cả vật tư đã tạo · {data.items.length} mục</p></div>
                <button type="button" onClick={() => openModal("ITEM")} className="btn-secondary"><Icon name="plus" size={16}/>Thêm vật tư</button>
              </div>
              <div className="admin-data-scroll overflow-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead><tr>{["Mã","Tên vật tư","Nhóm","Đơn vị","Giá vốn","Giá bán","Tồn tối thiểu","Thao tác"].map((header)=><th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
                  <tbody>
                    {data.items.map((item)=><tr key={item.id}>
                      <td className="p-3 font-black">{item.sku}</td><td className="p-3 font-bold">{item.name}</td><td className="p-3">{item.category}</td><td className="p-3">{item.unit}</td><td className="p-3">{money(item.costPrice)}</td><td className="p-3">{money(item.salePrice)}</td><td className="p-3">{item.minStock}</td>
                      <td className="p-3"><button type="button" disabled={busy} onClick={() => void deleteCatalog("DELETE_ITEM", item.id, `${item.sku} · ${item.name}`)} className="ghost-danger disabled:opacity-50">Xóa</button></td>
                    </tr>)}
                    {!data.items.length&&<tr><td colSpan={8} className="p-8 text-center text-slate-500">Chưa có vật tư. Bấm “Thêm vật tư” để tạo mục đầu tiên.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="surface-card overflow-hidden">
              <div className="data-toolbar">
                <div><h2 className="page-section-title">Danh sách kho</h2><p className="page-section-subtitle">Các kho đã tạo · {data.warehouses.length} kho</p></div>
                <button type="button" onClick={() => openModal("WAREHOUSE")} className="btn-secondary"><Icon name="store" size={16}/>Tạo kho</button>
              </div>
              <div className="admin-data-scroll overflow-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead><tr>{["Mã kho","Tên kho","Loại","Đại lý","Số mặt hàng","Tổng tồn","Thao tác"].map((header)=><th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
                  <tbody>
                    {data.warehouses.map((warehouse)=>{
                      const total = warehouse.balances.reduce((sum, row) => sum + row.quantity, 0);
                      return <tr key={warehouse.id}>
                        <td className="p-3 font-black">{warehouse.code}</td><td className="p-3 font-bold">{warehouse.name}</td><td className="p-3">{warehouseType(warehouse.type)}</td><td className="p-3">{warehouse.dealer ? `${warehouse.dealer.dealerCode} · ${warehouse.dealer.name}` : "—"}</td><td className="p-3">{warehouse.balances.length}</td><td className="p-3 font-black">{total}</td>
                        <td className="p-3"><button type="button" disabled={busy} onClick={() => void deleteCatalog("DELETE_WAREHOUSE", warehouse.id, `${warehouse.code} · ${warehouse.name}`)} className="ghost-danger disabled:opacity-50">Xóa</button></td>
                      </tr>;
                    })}
                    {!data.warehouses.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">Chưa có kho. Tạo kho tổng trước để bắt đầu nhập hàng.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="surface-card">
            <div className="data-toolbar">
              <div><h2 className="page-section-title">Tồn kho hiện tại</h2><p className="page-section-subtitle">Theo từng kho và mã vật tư</p></div>
              <div className="mobile-stack-actions flex flex-wrap gap-2">
                <button type="button" onClick={() => openModal("MOVE")} disabled={!data.items.length || !data.warehouses.length} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 font-bold text-white disabled:opacity-50"><Icon name="route" size={16}/>Lập phiếu kho</button>
              </div>
            </div>
            <div className="admin-data-scroll overflow-auto">
              <table className="min-w-[820px] w-full text-sm"><thead><tr>{["Kho","Mã vật tư","Tên vật tư","Nhóm","Tồn","Giữ chỗ","Khả dụng","Ngưỡng"].map((header)=><th key={header} className="p-3 text-left">{header}</th>)}</tr></thead><tbody>
                {balances.map((row)=><tr key={row.id}><td className="p-3"><strong>{row.warehouse.name}</strong><div className="text-xs text-slate-500">{row.warehouse.code}</div></td><td className="p-3 font-black">{row.item.sku}</td><td className="p-3">{row.item.name}</td><td className="p-3">{row.item.category}</td><td className="p-3 font-black">{row.quantity}</td><td className="p-3">{row.reserved}</td><td className="p-3 font-bold text-emerald-700">{Math.max(0,row.quantity-row.reserved)}</td><td className="p-3"><StatusBadge value={row.quantity<=row.item.minStock?"HIGH":"ACTIVE"}/></td></tr>)}
                {!balances.length&&<tr><td colSpan={8} className="p-10 text-center text-slate-500">Chưa có tồn kho. Hãy tạo vật tư, tạo kho và lập phiếu nhập đầu tiên.</td></tr>}
              </tbody></table>
            </div>
          </section>

          <section className="surface-card">
            <div className="data-toolbar"><div><h2 className="page-section-title">100 giao dịch gần nhất</h2><p className="page-section-subtitle">Nhập, xuất, điều chuyển và sử dụng cho dịch vụ</p></div></div>
            <div className="admin-data-scroll overflow-auto"><table className="min-w-[920px] w-full text-sm"><thead><tr>{["Mã phiếu","Loại","Vật tư","Từ kho","Đến kho","Số lượng","Đơn giá","Thời gian"].map((header)=><th key={header} className="p-3 text-left">{header}</th>)}</tr></thead><tbody>
              {data.movements.map((movement)=><tr key={movement.id}><td className="p-3 font-black">{movement.movementCode}</td><td className="p-3"><StatusBadge value={movement.type}/></td><td className="p-3">{movement.item.name}<div className="text-xs text-slate-500">{movement.item.sku}</div></td><td className="p-3">{movement.fromWarehouse?.name||"—"}</td><td className="p-3">{movement.toWarehouse?.name||"—"}</td><td className="p-3 font-black">{movement.quantity}</td><td className="p-3">{money(movement.unitCost)}</td><td className="p-3">{date(movement.createdAt)}</td></tr>)}
              {!data.movements.length&&<tr><td colSpan={8} className="p-10 text-center text-slate-500">Chưa có giao dịch kho.</td></tr>}
            </tbody></table></div>
          </section>
        </>}
      </div>

      {modal && data && <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&closeModal()}><div className="modal-panel max-w-2xl" role="dialog" aria-modal="true">
        <div className="modal-header"><div><p className="section-kicker">Quản lý kho</p><h3 className="mt-1 text-xl font-black">{modal==="ITEM"?"Thêm vật tư":modal==="WAREHOUSE"?"Tạo kho mới":"Lập phiếu kho"}</h3></div><button type="button" onClick={closeModal} disabled={busy} className="icon-button"><Icon name="x" size={18}/></button></div>
        <div className="modal-body">{error&&<Notice kind="error">{error}</Notice>}
          {modal==="ITEM"?<form id="inventory-item-form" onSubmit={(event)=>{event.preventDefault();void submit("CREATE_ITEM",itemForm);}} className="form-grid">
            <Field label="Mã vật tư" className="span-4"><input required value={itemForm.sku} onChange={(e)=>setItemForm({...itemForm,sku:e.target.value})}/></Field>
            <Field label="Tên vật tư" className="span-8"><input required value={itemForm.name} onChange={(e)=>setItemForm({...itemForm,name:e.target.value})}/></Field>
            <Field label="Nhóm" className="span-4"><input required value={itemForm.category} onChange={(e)=>setItemForm({...itemForm,category:e.target.value})}/></Field>
            <Field label="Đơn vị" className="span-4"><input required value={itemForm.unit} onChange={(e)=>setItemForm({...itemForm,unit:e.target.value})}/></Field>
            <Field label="Tồn tối thiểu" className="span-4"><input type="number" min="0" required value={itemForm.minStock} onChange={(e)=>setItemForm({...itemForm,minStock:e.target.value})}/></Field>
            <Field label="Giá vốn" className="span-6"><input type="number" min="0" required value={itemForm.costPrice} onChange={(e)=>setItemForm({...itemForm,costPrice:e.target.value})}/></Field>
            <Field label="Giá bán" className="span-6"><input type="number" min="0" required value={itemForm.salePrice} onChange={(e)=>setItemForm({...itemForm,salePrice:e.target.value})}/></Field>
          </form>:modal==="WAREHOUSE"?<form id="inventory-warehouse-form" onSubmit={(event)=>{event.preventDefault();void submit("CREATE_WAREHOUSE",warehouseForm);}} className="form-grid">
            <Field label="Mã kho" className="span-4"><input required value={warehouseForm.code} onChange={(e)=>setWarehouseForm({...warehouseForm,code:e.target.value})}/></Field>
            <Field label="Tên kho" className="span-8"><input required value={warehouseForm.name} onChange={(e)=>setWarehouseForm({...warehouseForm,name:e.target.value})}/></Field>
            <Field label="Loại kho" className="span-4"><select value={warehouseForm.type} onChange={(e)=>setWarehouseForm({...warehouseForm,type:e.target.value,dealerId:e.target.value==="DEALER"?warehouseForm.dealerId:""})}><option value="CENTRAL">Kho tổng</option><option value="REGIONAL">Kho khu vực</option><option value="DEALER">Kho đại lý</option></select></Field>
            <Field label="Đại lý sở hữu" className="span-8"><select required={warehouseForm.type==="DEALER"} disabled={warehouseForm.type!=="DEALER"} value={warehouseForm.dealerId} onChange={(e)=>{const dealer=data.dealers.find((row)=>row.id===e.target.value);setWarehouseForm({...warehouseForm,dealerId:e.target.value,province:dealer?.province||warehouseForm.province});}}><option value="">{warehouseForm.type==="DEALER"?"Chọn đại lý":"Không áp dụng"}</option>{data.dealers.filter((dealer)=>!data.warehouses.some((warehouse)=>warehouse.dealer?.dealerCode===dealer.dealerCode)).map((dealer)=><option key={dealer.id} value={dealer.id}>{dealer.dealerCode} · {dealer.name}</option>)}</select></Field>
            <Field label="Tỉnh/thành" className="span-4"><input value={warehouseForm.province} onChange={(e)=>setWarehouseForm({...warehouseForm,province:e.target.value})}/></Field>
            <Field label="Địa chỉ kho" className="span-8"><input value={warehouseForm.address} onChange={(e)=>setWarehouseForm({...warehouseForm,address:e.target.value})}/></Field>
          </form>:<form id="inventory-movement-form" onSubmit={submitMovement} className="form-grid">
            <Field label="Loại phiếu" className="span-4"><select value={moveForm.type} onChange={(e)=>changeMoveType(e.target.value as MoveType)}><option value="IN">Nhập kho</option><option value="OUT">Xuất kho</option><option value="TRANSFER">Điều chuyển</option><option value="ADJUST_IN">Điều chỉnh tăng</option><option value="ADJUST_OUT">Điều chỉnh giảm</option></select></Field>
            <Field label="Vật tư" className="span-8"><select required value={moveForm.itemId} onChange={(e)=>changeItem(e.target.value)}>{data.items.map((item)=><option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></Field>
            <Field label="Kho xuất" className="span-6"><select required={needsFrom} disabled={!needsFrom} value={moveForm.fromWarehouseId} onChange={(e)=>setMoveForm({...moveForm,fromWarehouseId:e.target.value,toWarehouseId:moveForm.toWarehouseId===e.target.value?"":moveForm.toWarehouseId})}><option value="">{needsFrom?(sourceWarehouses.length?"Chọn kho xuất":"Không có kho đủ tồn"):"Không áp dụng"}</option>{sourceWarehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}</select>{needsFrom&&moveForm.fromWarehouseId&&<p className={`mt-1 text-xs font-bold ${insufficient?"text-rose-600":"text-slate-500"}`}>Khả dụng: {selectedAvailable}</p>}</Field>
            <Field label="Kho nhận" className="span-6"><select required={needsTo} disabled={!needsTo} value={moveForm.toWarehouseId} onChange={(e)=>setMoveForm({...moveForm,toWarehouseId:e.target.value})}><option value="">{needsTo?"Chọn kho nhận":"Không áp dụng"}</option>{data.warehouses.filter((warehouse)=>warehouse.id!==moveForm.fromWarehouseId).map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}</select></Field>
            <Field label="Số lượng" className="span-4"><input type="number" min="1" max={needsFrom&&selectedSource?selectedAvailable:undefined} required value={moveForm.quantity} onChange={(e)=>setMoveForm({...moveForm,quantity:e.target.value})}/></Field>
            <Field label="Đơn giá" className="span-4"><input type="number" min="0" required value={moveForm.unitCost} onChange={(e)=>setMoveForm({...moveForm,unitCost:e.target.value})}/></Field>
            <Field label="Ghi chú" className="span-4"><input value={moveForm.note} onChange={(e)=>setMoveForm({...moveForm,note:e.target.value})}/></Field>
            {needsFrom&&!sourceWarehouses.length&&<div className="span-12"><Notice kind="warning">Vật tư này chưa có tồn khả dụng ở bất kỳ kho nào. Hãy nhập kho trước.</Notice></div>}
          </form>}
        </div>
        <div className="modal-footer"><button type="button" onClick={closeModal} disabled={busy} className="btn-secondary">Hủy</button><button type="submit" form={modal==="ITEM"?"inventory-item-form":modal==="WAREHOUSE"?"inventory-warehouse-form":"inventory-movement-form"} disabled={busy||(modal==="MOVE"&&(quantityInvalid||insufficient||sameWarehouse||(needsFrom&&!moveForm.fromWarehouseId)||(needsTo&&!moveForm.toWarehouseId)))} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-50">{busy?"Đang lưu...":modal==="ITEM"?"Lưu vật tư":modal==="WAREHOUSE"?"Tạo kho":"Ghi nhận phiếu"}</button></div>
      </div></div>}
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={className}><span className="mb-1 block text-sm font-bold">{label}</span>{children}</label>;
}
