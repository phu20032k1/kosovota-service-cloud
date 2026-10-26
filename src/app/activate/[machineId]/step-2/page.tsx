"use client";

import { ActionSessionBar } from "@/components/ActionSessionBar";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type MachineStatus = "Hoạt động tốt" | "Lỗi nhẹ" | "Cần hỗ trợ";
type MachineData = {
  id: string;
  model?: string | null;
  serial?: string | null;
  customer?: { name?: string | null; phone?: string | null; address?: string | null } | null;
};
type CurrentUser = { name?: string | null; phone?: string | null; role?: string | null; dealerCode?: string | null };

function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

export default function ActivationStepTwoPage(){
  const params=useParams<{machineId:string}>();
  const router=useRouter();
  const machineId=params.machineId;
  const submittingRef=useRef(false);
  const [machine,setMachine]=useState<MachineData|null>(null);
  const [user,setUser]=useState<CurrentUser|null>(null);
  const [stepOneReady,setStepOneReady]=useState<boolean|null>(null);
  const [alreadyCompleted,setAlreadyCompleted]=useState(false);
  const [installationDate,setInstallationDate]=useState(today());
  const [dealerCode,setDealerCode]=useState("");
  const [installerName,setInstallerName]=useState("");
  const [installerPhone,setInstallerPhone]=useState("");
  const [machineStatus,setMachineStatus]=useState<MachineStatus>("Hoạt động tốt");
  const [ownerNote,setOwnerNote]=useState("");
  const [bankAccount,setBankAccount]=useState("");
  const [accountHolder,setAccountHolder]=useState("");
  const [bankName,setBankName]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  useEffect(()=>{
    Promise.all([
      fetch(`/api/machines/${encodeURIComponent(machineId)}`,{cache:"no-store"}),
      fetch(`/api/activations?machineId=${encodeURIComponent(machineId)}&step=1`,{cache:"no-store"}),
      fetch(`/api/activations?machineId=${encodeURIComponent(machineId)}&step=2`,{cache:"no-store"}),
      fetch("/api/auth/me",{cache:"no-store"}),
    ]).then(async([machineResponse,stepOneResponse,stepTwoResponse,authResponse])=>{
      const [machineResult,stepOneResult,stepTwoResult,authResult]=await Promise.all([machineResponse.json(),stepOneResponse.json(),stepTwoResponse.json(),authResponse.ok?authResponse.json():Promise.resolve({})]);
      if(machineResponse.ok&&machineResult.success)setMachine(machineResult.data);
      setStepOneReady(Boolean(stepOneResponse.ok&&stepOneResult.success&&stepOneResult.data?.length));
      setAlreadyCompleted(Boolean(stepTwoResponse.ok&&stepTwoResult.success&&stepTwoResult.data?.length));
      if(authResponse.ok&&authResult.success){
        setUser(authResult.user);
        setDealerCode(authResult.user.dealerCode||"");
        setInstallerName(authResult.user.name||"");
        setInstallerPhone(authResult.user.phone||"");
      }
    }).catch(()=>{setError("Không tải được trạng thái kích hoạt.");setStepOneReady(false);});
  },[machineId]);

  const isAdmin=useMemo(()=>["ADMIN","SUPER_ADMIN"].includes(String(user?.role||"").toUpperCase()),[user?.role]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting||submittingRef.current)return;
    setError("");
    if(!stepOneReady)return setError("Phải hoàn thành bước 1 trước.");
    if(!installationDate)return setError("Hãy nhập ngày lắp đặt.");
    if(!dealerCode.trim())return setError("Thiếu mã đại lý.");
    if(!installerName.trim())return setError("Thiếu tên người lắp đặt.");
    if(installerPhone.replace(/\D/g,"").length<9)return setError("Số điện thoại người lắp chưa hợp lệ.");
    if(!bankAccount.trim()||!accountHolder.trim()||!bankName.trim())return setError("Cần nhập đủ thông tin nhận quà.");
    submittingRef.current=true;setSubmitting(true);
    try{
      const response=await fetch("/api/activations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({step:2,machineId,installationDate,dealerCode:dealerCode.trim(),installerName:installerName.trim(),installerPhone:installerPhone.trim(),machineStatus,ownerNote:ownerNote.trim(),bankAccount:bankAccount.trim(),accountHolder:accountHolder.trim(),bankName:bankName.trim()})});
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.message||"Không hoàn tất được kích hoạt.");
      setSuccess(result.message||"Kích hoạt máy thành công.");setAlreadyCompleted(true);window.scrollTo({top:0,behavior:"smooth"});
    }catch(e){setError(e instanceof Error?e.message:"Không hoàn tất được kích hoạt.");window.scrollTo({top:0,behavior:"smooth"});}
    finally{submittingRef.current=false;setSubmitting(false);}
  }

  if(stepOneReady===null)return <main className="grid min-h-screen place-items-center bg-slate-100 font-bold text-slate-500">Đang kiểm tra bước 1...</main>;
  if(!stepOneReady)return <main className="grid min-h-screen place-items-center bg-slate-100 p-4"><section className="w-full max-w-lg rounded-3xl bg-white p-7 text-center shadow-sm"><p className="text-sm font-black uppercase tracking-wider text-amber-600">Bước 2 chưa sẵn sàng</p><h1 className="mt-2 text-2xl font-black">Cần hoàn thành bước 1 trước</h1><p className="mt-3 text-slate-500">Chưa có thông tin khách hàng và vị trí máy.</p><Link href={`/activate/${encodeURIComponent(machineId)}/step-1`} className="btn-primary mt-6 inline-flex px-5 py-3 font-black text-white">Đi tới bước 1</Link></section></main>;

  return <main className="min-h-screen bg-slate-100 px-4 py-8"><ActionSessionBar title="Kích hoạt máy · Bước 2/2"/><form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-6">
    <header className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Bước 2 / 2</p><h1 className="mt-2 text-2xl font-black text-slate-950">Đại lý lắp đặt & hoàn tất kích hoạt</h1><p className="mt-2 text-sm text-slate-500">Bước này chỉ ghi nhận người lắp, ngày lắp, tình trạng máy và thông tin nhận quà. Không nhập lại khách hàng/GPS.</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black"><Link href={`/activate/${encodeURIComponent(machineId)}/step-1`} className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-emerald-700">✓ 1 · Khách & vị trí</Link><div className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-white">2 · Lắp đặt & hoàn tất</div></div></header>

    {error&&<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
    {success&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{success}</div>}

    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Thông tin từ bước 1</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Máy" value={machine?.serial||machine?.id||machineId}/><Info label="Model" value={machine?.model||"—"}/><Info label="Khách hàng" value={machine?.customer?.name||"Đã ghi nhận"}/><Info label="SĐT" value={machine?.customer?.phone||"—"}/></div>{machine?.customer?.address&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><strong>Địa chỉ:</strong> {machine.customer.address}</div>}</section>

    {alreadyCompleted&&!success&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Máy đã hoàn tất bước 2 trước đó. Gửi lại sẽ không tạo bản ghi kích hoạt trùng.</div>}

    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Lắp đặt</h2>
      <Field label="Ngày lắp đặt" required><input type="date" value={installationDate} onChange={(e)=>setInstallationDate(e.target.value)} className="form-input"/></Field>
      <Field label="Mã đại lý" required><input value={dealerCode} readOnly={!isAdmin} onChange={(e)=>setDealerCode(e.target.value.toUpperCase())} className={`form-input uppercase ${!isAdmin?"bg-slate-100":""}`} placeholder="Mã đại lý"/></Field>
      <Field label="Người lắp đặt" required><input value={installerName} onChange={(e)=>setInstallerName(e.target.value)} className="form-input" placeholder="Tên KTV/đại lý"/></Field>
      <Field label="Số điện thoại người lắp" required><input type="tel" inputMode="tel" value={installerPhone} onChange={(e)=>setInstallerPhone(e.target.value)} className="form-input" placeholder="SĐT người lắp"/></Field>
      <Field label="Tình trạng máy" required><select value={machineStatus} onChange={(e)=>setMachineStatus(e.target.value as MachineStatus)} className="form-input"><option>Hoạt động tốt</option><option>Lỗi nhẹ</option><option>Cần hỗ trợ</option></select></Field>
      <Field label="Lưu ý của chủ nhà"><textarea value={ownerNote} onChange={(e)=>setOwnerNote(e.target.value)} rows={4} className="form-input resize-none" placeholder="Yêu cầu hoặc lưu ý..."/></Field>
    </section>

    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"><div><h2 className="font-black text-slate-900">Thông tin nhận quà <span className="text-red-600">*</span></h2><p className="mt-1 text-sm text-slate-500">Nhập đủ ba mục để hoàn tất kích hoạt.</p></div>
      <Field label="Số tài khoản" required><input value={bankAccount} onChange={(e)=>setBankAccount(e.target.value.replace(/\D/g,""))} inputMode="numeric" className="form-input"/></Field>
      <Field label="Chủ tài khoản" required><input value={accountHolder} onChange={(e)=>setAccountHolder(e.target.value.toUpperCase())} className="form-input uppercase"/></Field>
      <Field label="Ngân hàng" required><input value={bankName} onChange={(e)=>setBankName(e.target.value)} className="form-input"/></Field>
    </section>

    <button type="submit" disabled={submitting} className="btn-primary w-full justify-center px-6 py-4 text-base font-black text-white disabled:opacity-50">{submitting?"Đang hoàn tất...":alreadyCompleted?"Kiểm tra / hoàn tất lại":"Hoàn tất kích hoạt"}</button>
    <div className="flex justify-center gap-4 text-sm font-bold"><Link href={`/activate/${encodeURIComponent(machineId)}/step-1`} className="text-slate-500 underline">Quay lại bước 1</Link><button type="button" onClick={()=>router.push(`/qr/${encodeURIComponent(machineId)}`)} className="text-emerald-700 underline">Trang QR</button></div>
  </form></main>;
}

function Field({label,required=false,children}:{label:string;required?:boolean;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}{required&&<span className="ml-1 text-red-600">*</span>}</span>{children}</label>}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 break-words font-bold text-slate-900">{value}</p></div>}
