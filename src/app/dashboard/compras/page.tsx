"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  ArrowUpTrayIcon, ArrowDownTrayIcon, CalendarIcon, ChevronDownIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, BanknotesIcon,
  DocumentTextIcon, ShoppingCartIcon, UsersIcon,
  PencilIcon, XMarkIcon, CheckIcon, PlusIcon, TrashIcon,
} from "@heroicons/react/24/outline";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Pedido {
  id?: string;
  num_pedido: string;
  data_pedido: string;
  comprador: string;
  fornecedor: string;
  valor_inicial: number;
  valor_2_rodada: number | null;
  saving_rs: number | null;
  saving_pct: number | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseBRL = (s: string) => { const n = parseFloat(s.replace(/[R$\s.]/g,"").replace(",",".")); return isNaN(n) ? null : n; };

type TabId = "dashboard" | "pedidos";

const EMPTY_PEDIDO: Pedido = { num_pedido:"", data_pedido: new Date().toISOString().split("T")[0], comprador:"", fornecedor:"", valor_inicial:0, valor_2_rodada:null, saving_rs:null, saving_pct:null };

export default function ComprasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");

  const now = new Date();
  const [mesSel, setMesSel] = useState<number>(-1); // -1 = todos os meses
  const [anoSel, setAnoSel] = useState(now.getFullYear());

  const anos = useMemo(() => {
    const set = new Set(pedidos.map(p => new Date(p.data_pedido+"T12:00:00").getFullYear()));
    if (set.size === 0) return [now.getFullYear()];
    return Array.from(set).sort((a, b) => b - a);
  }, [pedidos]);

  useEffect(() => { fetchPedidos(); }, []);

  async function fetchPedidos() {
    setLoading(true);
    const { data, error } = await supabase.from("compras_pedidos").select("*").order("data_pedido", { ascending: false });
    if (error) toast.error("Erro ao carregar pedidos");
    else setPedidos(data || []);
    setLoading(false);
  }

  // ── Upload ──
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

      const parseNum = (v: any) => { if (v === null || v === undefined || v === "") return null; if (typeof v === "number") return v; const s = String(v).replace(/[R$\s.]/g,"").replace(",","."); const n = parseFloat(s); return isNaN(n) ? null : n; };
      const parseDate = (v: any): string | null => {
        if (!v) return null;
        if (v instanceof Date) { if (isNaN(v.getTime())) return null; const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,"0"),d=String(v.getDate()).padStart(2,"0"); if(y<1900||y>2100) return null; return `${y}-${m}-${d}`; }
        if (typeof v === "number") { const date=new Date((v-25569)*86400*1000); if(isNaN(date.getTime())) return null; const y=date.getUTCFullYear(),m=String(date.getUTCMonth()+1).padStart(2,"0"),d=String(date.getUTCDate()).padStart(2,"0"); if(y<1900||y>2100) return null; return `${y}-${m}-${d}`; }
        const s=String(v).trim();
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) { const[ds,ms,ys]=s.split("/"); let yi=parseInt(ys,10); const mi=parseInt(ms,10),di=parseInt(ds,10); if(ys.length===2)yi+=2000; if(mi<1||mi>12||di<1||di>31) return null; return `${yi}-${String(mi).padStart(2,"0")}-${String(di).padStart(2,"0")}`; }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const parsed=new Date(s); if(!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
        return null;
      };
      const colMap = (row: any, aliases: string[]) => { const keys=Object.keys(row); for(const a of aliases){const k=keys.find(k=>k.toString().trim().toUpperCase().includes(a.toUpperCase())); if(k!==undefined)return row[k];} return null; };

      const formatted: Pedido[] = rows.map(row => ({
        num_pedido: String(colMap(row,["N° PEDIDO","PEDIDO","NR_PEDIDO","NUM"])||"").trim(),
        data_pedido: parseDate(colMap(row,["DATA PEDIDO","DATA_PEDIDO","DATA"]))||new Date().toISOString().split("T")[0],
        comprador: String(colMap(row,["COMPRADOR"])||"").trim(),
        fornecedor: String(colMap(row,["FORNECEDOR"])||"").trim(),
        valor_inicial: parseNum(colMap(row,["VALOR INICIAL","VALOR_INICIAL","VALOR 1","VALOR1"])) ?? 0,
        valor_2_rodada: parseNum(colMap(row,["VALOR 2 RODADA","VALOR_2_RODADA","VALOR2"])),
        saving_rs: parseNum(colMap(row,["SAVING R$","SAVING_RS","SAVING RS"])),
        saving_pct: parseNum(colMap(row,["SAVING %","SAVING_PCT","SAVING%"])),
      })).filter(r => r.num_pedido || r.fornecedor);

      if (formatted.length === 0) { toast.error("Nenhum dado válido."); return; }
      if (!confirm(`Importar ${formatted.length} pedidos?`)) return;

      // Deduplicar
      const comNum: Pedido[] = []; const semNum: Pedido[] = []; const seen = new Map<string,number>();
      formatted.forEach(r => {
        if (!r.num_pedido) { semNum.push({...r, num_pedido:`AUTO-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}); }
        else if (seen.has(r.num_pedido)) { comNum[seen.get(r.num_pedido)!]=r; }
        else { seen.set(r.num_pedido,comNum.length); comNum.push(r); }
      });
      const tudo=[...comNum,...semNum];
      for(let i=0;i<tudo.length;i+=100){
        const {error}=await supabase.from("compras_pedidos").upsert(tudo.slice(i,i+100),{onConflict:"num_pedido",ignoreDuplicates:false});
        if(error) throw error;
      }
      toast.success(`${tudo.length} pedidos importados!`);
      fetchPedidos();
    } catch(err:any) { toast.error("Erro ao importar: "+(err.message||"")); }
    finally { setUploading(false); e.target.value=""; }
  }

  // ── Salvar edição / novo ──
  async function handleSave() {
    if (!editPedido) return;
    setSaving(true);
    try {
      if (editPedido.id) {
        const { error } = await supabase.from("compras_pedidos").update({ ...editPedido }).eq("id", editPedido.id);
        if (error) throw error;
        setPedidos(prev => prev.map(p => p.id === editPedido.id ? editPedido : p));
      } else {
        const { data, error } = await supabase.from("compras_pedidos").insert([editPedido]).select().single();
        if (error) throw error;
        setPedidos(prev => [data, ...prev]);
      }
      toast.success("Salvo!");
      setShowModal(false);
    } catch(err:any) { toast.error("Erro: "+err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pedido?")) return;
    const { error } = await supabase.from("compras_pedidos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setPedidos(prev => prev.filter(p => p.id !== id));
    toast.success("Excluído!");
  }

  // ── Filtros ──
  const pedidosMes = useMemo(() => pedidos.filter(p => {
    if(!p.data_pedido) return false;
    const d=new Date(p.data_pedido+"T12:00:00");
    if(d.getFullYear()!==anoSel) return false;
    if(mesSel===-1) return true; // todos os meses
    return d.getMonth()===mesSel;
  }), [pedidos,mesSel,anoSel]);
  const pedidosAno = useMemo(() => pedidos.filter(p => { if(!p.data_pedido) return false; return new Date(p.data_pedido+"T12:00:00").getFullYear()===anoSel; }), [pedidos,anoSel]);
  const pedidosFiltrados = useMemo(() => pedidosMes.filter(p => !busca || [p.num_pedido,p.comprador,p.fornecedor].some(v => v?.toLowerCase().includes(busca.toLowerCase()))), [pedidosMes, busca]);

  const periodoLabel = mesSel===-1 ? `Ano ${anoSel}` : `${MESES[mesSel]}/${anoSel}`;

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalMes=pedidosMes.length, totalAno=pedidosAno.length;
    const acimaMes=pedidosMes.filter(p=>p.valor_inicial>=5000).length;
    const abaixoMes=pedidosMes.filter(p=>p.valor_inicial<5000).length;
    const savingMes=pedidosMes.reduce((s,p)=>s+(p.saving_rs??0),0);
    const savingAno=pedidosAno.reduce((s,p)=>s+(p.saving_rs??0),0);
    const valorTotalMes=pedidosMes.reduce((s,p)=>s+(p.valor_inicial??0),0);
    const rodada2Mes=pedidosMes.filter(p=>p.valor_2_rodada&&p.valor_2_rodada>0).length;
    return { totalMes, totalAno, acimaMes, abaixoMes, savingMes, savingAno, valorTotalMes, rodada2Mes };
  }, [pedidosMes, pedidosAno]);

  const donutData = useMemo(() => [
    { name:`Acima de R$ 5.000 (${kpis.acimaMes})`, value:kpis.acimaMes, color:"#6366f1" },
    { name:`Abaixo de R$ 5.000 (${kpis.abaixoMes})`, value:kpis.abaixoMes, color:"#f97316" },
  ], [kpis]);

  const COMPRADOR_COLORS = ["#6366f1","#f97316","#0ea5e9","#ec4899","#14b8a6","#f59e0b","#8b5cf6","#ef4444"];

  const economiaComprador = useMemo(() => {
    const map: Record<string,number>={};
    pedidosMes.forEach(p=>{ if(p.comprador) map[p.comprador]=(map[p.comprador]||0)+(p.saving_rs??0); });
    return Object.entries(map).map(([name,value],i)=>({name,value,color:COMPRADOR_COLORS[i%COMPRADOR_COLORS.length]})).sort((a,b)=>b.value-a.value).slice(0,6);
  }, [pedidosMes]);

  function handleExport() {
    const ws=XLSX.utils.json_to_sheet(pedidosMes.map(p=>({ "Nº Pedido":p.num_pedido,"Data":p.data_pedido,"Comprador":p.comprador,"Fornecedor":p.fornecedor,"Valor Inicial":p.valor_inicial,"Valor 2ª Rodada":p.valor_2_rodada??"","Saving R$":p.saving_rs??"","Saving %":p.saving_pct??"" })));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Pedidos");
    XLSX.writeFile(wb,`compras_${periodoLabel.replace("/","_")}.xlsx`);
  }

  const pctAcima=kpis.totalMes?((kpis.acimaMes/kpis.totalMes)*100).toFixed(2):"0.00";
  const pctAbaixo=kpis.totalMes?((kpis.abaixoMes/kpis.totalMes)*100).toFixed(2):"0.00";
  const pctRodada2=kpis.totalMes?((kpis.rodada2Mes/kpis.totalMes)*100).toFixed(2):"0.00";

  return (
    <div className="w-full pb-10">
      {/* ══ HEADER ══ */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard de Compras</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visão geral de performance de compras e economia</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 shadow-sm">
            <CalendarIcon className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            <select
              value={mesSel}
              onChange={e=>setMesSel(Number(e.target.value))}
              className="text-sm font-semibold text-gray-800 dark:text-white bg-transparent outline-none cursor-pointer"
            >
              <option value={-1}>Todos os meses</option>
              {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 shadow-sm">
            <select value={anoSel} onChange={e=>setAnoSel(Number(e.target.value))} className="text-sm font-semibold text-gray-800 dark:text-white bg-transparent outline-none cursor-pointer">
              {anos.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-300" />
          </div>
          <label className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all shadow-sm border ${uploading?"bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:border-gray-700":"bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50"}`}>
            <ArrowUpTrayIcon className="w-4 h-4" />
            {uploading?"Importando...":"Subir Planilha"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <ArrowDownTrayIcon className="w-4 h-4" />Exportar
          </button>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-fit">
        {([["dashboard","Dashboard"],["pedidos","Pedidos"]] as [TabId,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab===id?"bg-white dark:bg-gray-800 text-[#0b7336] shadow-sm":"text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-[#0b7336] border-t-transparent rounded-full" /></div>}

      {/* ══ TAB DASHBOARD ══ */}
      {activeTab==="dashboard" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KpiCard icon={<DocumentTextIcon className="w-6 h-6"/>} iconBg="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" title="REQUISIÇÕES EMITIDAS" mes={kpis.totalMes} ano={kpis.totalAno} label="NO MÊS" labelAno="NO ANO" />
            <KpiCard icon={<ShoppingCartIcon className="w-6 h-6"/>} iconBg="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" title="PEDIDOS EMITIDOS" mes={kpis.totalMes} ano={kpis.totalAno} label="NO MÊS" labelAno="NO ANO" />
            <KpiCard icon={<ArrowTrendingUpIcon className="w-6 h-6"/>} iconBg="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400" title="PEDIDOS ACIMA DE R$ 5.000" mes={kpis.acimaMes} sub={`${pctAcima}%`} label="NO MÊS" labelAno={pctAcima+"%"} />
            <KpiCard icon={<ArrowTrendingDownIcon className="w-6 h-6"/>} iconBg="bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400" title="PEDIDOS ABAIXO DE R$ 5.000" mes={kpis.abaixoMes} sub={`${pctAbaixo}%`} label="NO MÊS" labelAno={pctAbaixo+"%"} />
            <KpiCard icon={<BanknotesIcon className="w-6 h-6"/>} iconBg="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400" title="SAVING DE COMPRAS" mes={null} ano={null} label="NO MÊS" labelAno="NO ANO" mesStr={fmtBRL(kpis.savingMes)} anoStr={fmtBRL(kpis.savingAno)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Pedidos por Faixa de Valor (Mês)</h3>
              {kpis.totalMes===0 ? <div className="flex items-center justify-center h-48 text-sm text-gray-400">Sem dados</div> : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>{donutData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}</Pie><Tooltip formatter={(v:any)=>[v,"Pedidos"]}/></PieChart></ResponsiveContainer>
                  <div className="space-y-2 w-full mt-2">{donutData.map((d,i)=><div key={i} className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded-full flex-shrink-0" style={{background:d.color}}/><span className="text-gray-600 dark:text-gray-400">{d.name}</span></div>)}</div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Pedidos por Rodada de Negociação (Mês)</h3>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl"><UsersIcon className="w-8 h-8 text-blue-500 mb-2"/><p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">2ª Rodada</p><p className="text-4xl font-black text-blue-600 dark:text-blue-400">{kpis.rodada2Mes}</p><p className="text-sm font-bold text-blue-500 mt-1">{pctRodada2}%</p></div>
                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Mês</p><p className="text-4xl font-black text-gray-700 dark:text-gray-200">{kpis.totalMes}</p><p className="text-xs text-gray-400 mt-1">pedidos</p></div>
              </div>
              <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-center">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Valor Negociado (Mês)</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{fmtBRL(kpis.valorTotalMes)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Valor Total das Compras</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Economia por Comprador (Mês)</h3>
              {economiaComprador.length===0 ? <div className="flex items-center justify-center h-48 text-sm text-gray-400">Sem savings registrados</div> : (
                <ResponsiveContainer width="100%" height={220}><BarChart data={economiaComprador} layout="vertical" margin={{left:0,right:20,top:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb"/><XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>`R$ ${(v/1000).toFixed(0)}k`}/><YAxis type="category" dataKey="name" tick={{fontSize:10}} width={80}/><Tooltip formatter={(v:any)=>[fmtBRL(v),"Saving"]}/><Bar dataKey="value" radius={[0,6,6,0]}>{economiaComprador.map((entry,i)=><Cell key={i} fill={entry.color}/>)}</Bar></BarChart></ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══ TAB PEDIDOS ══ */}
      {activeTab==="pedidos" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-gray-900 dark:text-white">
                Pedidos — {periodoLabel}
                <span className="ml-2 text-sm font-normal text-gray-400">({pedidosFiltrados.length} registros)</span>
              </h3>
            </div>
            <div className="flex gap-3 items-center">
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar pedido, comprador..." className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0b7336] w-64" />
              <button onClick={()=>{setEditPedido({...EMPTY_PEDIDO});setShowModal(true);}} className="flex items-center gap-2 px-4 py-2 bg-[#0b7336] text-white font-bold text-sm rounded-xl hover:bg-[#075a2a] transition-all shadow-md">
                <PlusIcon className="w-4 h-4"/>Novo Pedido
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  {["Nº Pedido","Data","Comprador","Fornecedor","Valor Inicial","Valor 2ª Rodada","Saving R$","Saving %",""].map(h=>(
                    <th key={h} className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pedidosFiltrados.length===0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">Nenhum pedido no período. Suba a planilha ou clique em "Novo Pedido".</td></tr>
                ) : pedidosFiltrados.map((p,i)=>(
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="px-4 py-3 font-bold text-[#0b7336]">{p.num_pedido||"—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.data_pedido?new Date(p.data_pedido+"T12:00:00").toLocaleDateString("pt-BR"):"—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{p.comprador||"—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={p.fornecedor}>{p.fornecedor||"—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmtBRL(p.valor_inicial??0)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.valor_2_rodada!=null?fmtBRL(p.valor_2_rodada):"—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.saving_rs!=null?<span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtBRL(p.saving_rs)}</span>:<span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.saving_pct!=null?<span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.saving_pct.toFixed(2)}%</span>:<span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>{setEditPedido({...p});setShowModal(true);}} className="p-1.5 text-gray-400 hover:text-[#0b7336] hover:bg-green-50 rounded-lg transition-colors" title="Editar"><PencilIcon className="w-4 h-4"/></button>
                        <button onClick={()=>p.id&&handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><TrashIcon className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODAL EDIÇÃO ══ */}
      {showModal && editPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2rem] p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">{editPedido.id?"Editar Pedido":"Novo Pedido"}</h2>
              <button onClick={()=>setShowModal(false)} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-full transition-colors"><XMarkIcon className="w-5 h-5 text-gray-500"/></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {label:"Nº Pedido",key:"num_pedido",type:"text"},
                {label:"Data do Pedido",key:"data_pedido",type:"date"},
                {label:"Comprador",key:"comprador",type:"text"},
                {label:"Fornecedor",key:"fornecedor",type:"text"},
              ].map(({label,key,type})=>(
                <div key={key}>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type} value={(editPedido as any)[key]||""} onChange={e=>setEditPedido(prev=>prev?{...prev,[key]:e.target.value}:prev)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b7336] outline-none"/>
                </div>
              ))}

              {[
                {label:"Valor Inicial (R$)",key:"valor_inicial"},
                {label:"Valor 2ª Rodada (R$)",key:"valor_2_rodada"},
                {label:"Saving R$",key:"saving_rs"},
                {label:"Saving %",key:"saving_pct"},
              ].map(({label,key})=>(
                <div key={key}>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type="number" step="0.01" value={(editPedido as any)[key]??""} onChange={e=>setEditPedido(prev=>prev?{...prev,[key]:e.target.value===""?null:parseFloat(e.target.value)}:prev)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0b7336] outline-none"/>
                </div>
              ))}
            </div>

            {/* Auto-calc saving */}
            {editPedido.valor_inicial>0 && editPedido.valor_2_rodada!=null && editPedido.valor_2_rodada>0 && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Saving calculado automaticamente:</span>
                <button onClick={()=>{const s=editPedido.valor_inicial-(editPedido.valor_2_rodada??0); const pct=(s/editPedido.valor_inicial)*100; setEditPedido(p=>p?{...p,saving_rs:parseFloat(s.toFixed(2)),saving_pct:parseFloat(pct.toFixed(2))}:p);}}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                  <CheckIcon className="w-3.5 h-3.5"/>
                  Aplicar {fmtBRL(editPedido.valor_inicial-(editPedido.valor_2_rodada??0))}
                </button>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#0b7336] text-white font-black rounded-2xl hover:bg-[#075a2a] active:scale-95 transition-all shadow-lg disabled:opacity-50">
                {saving?"Salvando...":"Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({icon,iconBg,title,mes,ano,label,labelAno,sub,mesStr,anoStr}:{icon:React.ReactNode;iconBg:string;title:string;mes:number|null;ano?:number|null;label:string;labelAno?:string;sub?:string;mesStr?:string;anoStr?:string;}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>{icon}</div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight mb-3">{title}</p>
      <div className="space-y-1">
        <div><p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p><p className="text-2xl font-black text-gray-900 dark:text-white">{mesStr??mes??0}</p>{sub&&<p className="text-xs font-bold text-gray-500">{sub}</p>}</div>
        {(ano!==undefined||anoStr)&&<div className="pt-1 border-t border-gray-100 dark:border-gray-700"><p className="text-[9px] font-bold text-gray-400 uppercase">{labelAno}</p><p className="text-sm font-bold text-gray-600 dark:text-gray-300">{anoStr??ano??0}</p></div>}
      </div>
    </div>
  );
}
