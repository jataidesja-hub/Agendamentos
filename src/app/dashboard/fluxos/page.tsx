"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  CheckCircleIcon,
  TruckIcon,
  CreditCardIcon,
  CheckBadgeIcon,
  XCircleIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

const GDRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1XDGKKU52DY_5Kw2mc6kKmjs5FRpfz2SH?usp=sharing";
const GDRIVE_FOLDER_ID = "1XDGKKU52DY_5Kw2mc6kKmjs5FRpfz2SH";
const STORAGE_FLUXOS_KEY = "cymi_fluxos_gdrive_cache_v1";
const STORAGE_WEBHOOK_KEY = "cymi_gdrive_webhook_url";

export interface FluxoAbastecimento {
  id: string;
  placa: string | null;
  cartao: string | null;
  projeto: string | null;
  justificativa: string;
  valor: number;
  status: "solicitado" | "recusado" | "aprovado" | "feito";
  solicitado_por: string;
  solicitado_em: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  recusado_por: string | null;
  recusado_em: string | null;
  motivo_recusa: string | null;
  feito_por: string | null;
  feito_em: string | null;
  pdf_assinado_nome: string | null;
  pdf_assinado_url: string | null;
  created_at: string;
}

// Empacota metadados extras dentro de observacao_fluxo para sincronizar entre todos os usuários sem precisar alterar colunas do banco
const parseMeta = (raw: string | null | undefined) => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const rowToFluxo = (r: any): FluxoAbastecimento => {
  const meta = parseMeta(r.observacao_fluxo);
  return {
    id: r.id,
    placa: r.placa || null,
    cartao: r.cartao || null,
    projeto: r.projeto || null,
    justificativa: r.justificativa || "",
    valor: Number(r.valor) || 0,
    status: (r.status as any) || "solicitado",
    solicitado_por: r.solicitado_por || "",
    solicitado_em: r.solicitado_em || r.created_at,
    aprovado_por: r.aprovado_por || null,
    aprovado_em: r.aprovado_em || null,
    recusado_por: meta.recusado_por || null,
    recusado_em: meta.recusado_em || null,
    motivo_recusa: meta.motivo_recusa || null,
    feito_por: r.feito_por || null,
    feito_em: r.feito_em || null,
    pdf_assinado_nome: meta.pdf_assinado_nome || null,
    pdf_assinado_url: meta.pdf_assinado_url || null,
    created_at: r.created_at || new Date().toISOString(),
  };
};

const fluxoToRow = (f: FluxoAbastecimento) => {
  const meta = {
    recusado_por: f.recusado_por || null,
    recusado_em: f.recusado_em || null,
    motivo_recusa: f.motivo_recusa || null,
    pdf_assinado_nome: f.pdf_assinado_nome || null,
    pdf_assinado_url: f.pdf_assinado_url || null,
  };
  return {
    id: f.id,
    placa: f.placa,
    cartao: f.cartao,
    projeto: f.projeto,
    justificativa: f.justificativa,
    valor: f.valor,
    status: f.status,
    solicitado_por: f.solicitado_por,
    solicitado_em: f.solicitado_em,
    aprovado_por: f.aprovado_por,
    aprovado_em: f.aprovado_em,
    feito_por: f.feito_por,
    feito_em: f.feito_em,
    observacao_fluxo: JSON.stringify(meta),
    created_at: f.created_at,
  };
};

const fmtCurrency = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDateTime = (d: string | null) => {
  if (!d) return "---";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function FluxosAbastecimentoPage() {
  const [userEmail, setUserEmail] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [papelFluxo, setPapelFluxo] = useState<"adm" | "gerente" | "master">("adm");
  const [projetosPermitidos, setProjetosPermitidos] = useState<string[] | null>(null);

  const [fluxos, setFluxos] = useState<FluxoAbastecimento[]>([]);
  const [frotaMap, setFrotaMap] = useState<Map<string, string>>(new Map());
  const [placasGerenteSet, setPlacasGerenteSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Integração Google Drive Webhook (Apps Script)
  const [gdriveWebhookUrl, setGdriveWebhookUrl] = useState("");
  const [showConfigDrive, setShowConfigDrive] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");

  // Modal Nova Solicitação
  const [showModal, setShowModal] = useState(false);
  const [placa, setPlaca] = useState("");
  const [cartao, setCartao] = useState("");
  const [projeto, setProjeto] = useState("");
  const [valor, setValor] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Modal Recusar / Alterar Valor
  const [itemParaRecusar, setItemParaRecusar] = useState<FluxoAbastecimento | null>(null);
  const [motivoRecusaInput, setMotivoRecusaInput] = useState("");
  const [novoValorRecusa, setNovoValorRecusa] = useState("");

  // Modal Alterar Valor pelo ADM
  const [itemEditarValor, setItemEditarValor] = useState<FluxoAbastecimento | null>(null);
  const [valorEditadoInput, setValorEditadoInput] = useState("");
  const [justificativaEditadaInput, setJustificativaEditadaInput] = useState("");

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState<
    "todos" | "solicitado" | "recusado" | "aprovado" | "feito"
  >("todos");

  useEffect(() => {
    const savedWebhook =
      process.env.NEXT_PUBLIC_GDRIVE_FLUXOS_URL ||
      localStorage.getItem(STORAGE_WEBHOOK_KEY) ||
      "";
    setGdriveWebhookUrl(savedWebhook);
    setWebhookInput(savedWebhook);
    carregarContexto(savedWebhook);
  }, []);

  const carregarContexto = async (webhookUrl: string) => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = (session?.user?.email || "").toLowerCase().trim();
      setUserEmail(email);

      if (email) {
        const { data: perfil } = await supabase
          .from("perfis_acesso")
          .select("*")
          .ilike("email", email)
          .single();

        if (perfil) {
          const masterFlag = Boolean(perfil.master) || email === "logistica@cymi.com.br";
          setIsMaster(masterFlag);
          if (masterFlag) {
            setPapelFluxo("master");
          } else if (perfil.papel_fluxo === "gerente") {
            setPapelFluxo("gerente");
            setProjetosPermitidos(perfil.projetos_acesso || []);
          } else {
            setPapelFluxo("adm");
            setProjetosPermitidos(perfil.projetos_acesso || []);
          }
        } else if (email === "logistica@cymi.com.br") {
          setIsMaster(true);
          setPapelFluxo("master");
        }
      }

      const { data: frota } = await supabase
        .from("frota_veiculos")
        .select("placa, projeto, email_gerente")
        .eq("arquivado", false);

      if (frota) {
        const mapP = new Map<string, string>();
        const setGer = new Set<string>();
        frota.forEach((f: any) => {
          const p = String(f.placa || "").toUpperCase().trim();
          if (p) {
            if (f.projeto) mapP.set(p, String(f.projeto).toUpperCase().trim());
            if (
              email &&
              f.email_gerente &&
              String(f.email_gerente).toLowerCase().includes(email)
            ) {
              setGer.add(p);
            }
          }
        });
        setFrotaMap(mapP);
        setPlacasGerenteSet(setGer);
        if (setGer.size > 0 && !isMaster) {
          setPapelFluxo("gerente");
        }
      }

      await carregarFluxos(webhookUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Carrega e mescla solicitações entre o banco compartilhado (para todos os usuários verem) + itens locais criados anteriormente + Google Drive
  const carregarFluxos = async (webhookUrl = gdriveWebhookUrl) => {
    try {
      // 1. Lê qualquer item que o usuário tenha criado localmente no navegador antes
      let localItems: FluxoAbastecimento[] = [];
      const localRaw = localStorage.getItem(STORAGE_FLUXOS_KEY);
      if (localRaw) {
        try {
          localItems = JSON.parse(localRaw);
        } catch {}
      }

      // 2. Busca da tabela compartilhada para todos os computadores verem em tempo real
      const { data: dbRows, error } = await supabase
        .from("fluxos_abastecimento")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && dbRows) {
        const dbItems = dbRows.map(rowToFluxo);
        const dbIds = new Set(dbItems.map((d) => d.id));

        // Se existia algum item apenas no navegador local deste usuário (ex: do teste do Joaquim), sobe automaticamente para todos verem
        const missingInDb = localItems.filter((l) => l.id && !dbIds.has(l.id));
        if (missingInDb.length > 0) {
          await supabase
            .from("fluxos_abastecimento")
            .upsert(missingInDb.map(fluxoToRow), { onConflict: "id" });
        }

        const merged = [...missingInDb, ...dbItems].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setFluxos(merged);
        localStorage.setItem(STORAGE_FLUXOS_KEY, JSON.stringify(merged));
        return;
      }

      // Fallback Drive / Local
      if (webhookUrl) {
        const res = await fetch(webhookUrl, { method: "GET" });
        if (res.ok) {
          const remoteData = await res.json();
          if (Array.isArray(remoteData)) {
            setFluxos(remoteData);
            localStorage.setItem(STORAGE_FLUXOS_KEY, JSON.stringify(remoteData));
            return;
          }
        }
      }

      setFluxos(localItems);
    } catch (e) {
      console.warn("Erro ao carregar fluxos:", e);
    }
  };

  // Salva um item modificado/criado para que apareça imediatamente na tela de todos os usuários + envia ao Google Drive
  const salvarItemCompartilhado = async (
    itemAtualizado: FluxoAbastecimento,
    novaLista: FluxoAbastecimento[]
  ) => {
    setFluxos(novaLista);
    localStorage.setItem(STORAGE_FLUXOS_KEY, JSON.stringify(novaLista));

    // Sincroniza no banco compartilhado para aparecer em todas as telas
    await supabase
      .from("fluxos_abastecimento")
      .upsert(fluxoToRow(itemAtualizado), { onConflict: "id" });

    // Se tiver webhook do Google Drive configurado, espelha também no Drive
    if (gdriveWebhookUrl) {
      try {
        await fetch(gdriveWebhookUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "save_all",
            folderId: GDRIVE_FOLDER_ID,
            fluxos: novaLista,
          }),
        });
      } catch (e) {
        console.error("Erro ao sincronizar com Google Drive:", e);
      }
    }
  };

  const handleSalvarWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    const url = webhookInput.trim();
    setGdriveWebhookUrl(url);
    localStorage.setItem(STORAGE_WEBHOOK_KEY, url);
    setShowConfigDrive(false);
    toast.success("Conexão com a pasta do Google Drive salva!");
    if (url) carregarFluxos(url);
  };

  const handlePlacaChange = (val: string) => {
    const up = val.toUpperCase();
    setPlaca(up);
    const clean = up.replace(/[^A-Z0-9]/g, "");
    if (frotaMap.has(up)) {
      setProjeto(frotaMap.get(up) || "");
    } else if (frotaMap.has(clean)) {
      setProjeto(frotaMap.get(clean) || "");
    }
  };

  // ── GERAR PDF DE SOLICITAÇÃO PARA ASSINATURA DO GERENTE ───────────────────
  const gerarPDFParaAssinatura = (item: FluxoAbastecimento) => {
    const doc = new jsPDF();

    doc.setFillColor(11, 115, 54);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CYMI - SOLICITACAO DE ABASTECIMENTO / SALDO", 14, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Protocolo ID: ${item.id.slice(0, 8).toUpperCase()}`, 14, 24);
    doc.text(`Data/Hora Emissao: ${fmtDateTime(item.solicitado_em)}`, 130, 24);

    doc.setTextColor(30, 30, 30);
    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(248, 250, 249);
    doc.roundedRect(14, 40, 182, 75, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DADOS DA SOLICITACAO", 20, 50);

    doc.setFontSize(10);
    doc.text("Solicitante (ADM):", 20, 62);
    doc.setFont("helvetica", "normal");
    doc.text(item.solicitado_por || "---", 65, 62);

    doc.setFont("helvetica", "bold");
    doc.text("Placa do Veiculo:", 20, 72);
    doc.setFont("helvetica", "normal");
    doc.text(item.placa || "Nao informada", 65, 72);

    doc.setFont("helvetica", "bold");
    doc.text("Cartao:", 120, 72);
    doc.setFont("helvetica", "normal");
    doc.text(item.cartao || "Nao informado", 145, 72);

    doc.setFont("helvetica", "bold");
    doc.text("Projeto:", 20, 82);
    doc.setFont("helvetica", "normal");
    doc.text(item.projeto || "SEM PROJETO", 65, 82);

    doc.setFont("helvetica", "bold");
    doc.text("VALOR SOLICITADO:", 20, 96);
    doc.setFontSize(14);
    doc.setTextColor(11, 115, 54);
    doc.text(fmtCurrency(item.valor), 68, 96);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("JUSTIFICATIVA:", 14, 128);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const splitJust = doc.splitTextToSize(item.justificativa || "---", 180);
    doc.text(splitJust, 14, 136);

    const yAssin = 200;
    doc.setDrawColor(100, 100, 100);
    doc.line(20, yAssin, 95, yAssin);
    doc.line(115, yAssin, 190, yAssin);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ASSINATURA DO SOLICITANTE (ADM)", 25, yAssin + 6);
    doc.setFont("helvetica", "normal");
    doc.text(item.solicitado_por, 25, yAssin + 12);

    doc.setFont("helvetica", "bold");
    doc.text("ASSINATURA / APROVACAO DO GERENTE", 120, yAssin + 6);
    doc.setFont("helvetica", "normal");
    doc.text("Data: ____/____/202__   (  ) Aprovado   (  ) Recusado", 115, yAssin + 12);

    doc.save(
      `Solicitacao_Abastecimento_${item.placa || item.cartao || "CYMI"}_${item.id.slice(0, 5)}.pdf`
    );
    toast.success("PDF gerado! Envie para o Gerente assinar e depois suba o PDF assinado.");
  };

  // ── UPLOAD DO PDF ASSINADO PELO GERENTE ────────────────────────────────────
  const handleUploadPdfAssinado = async (item: FluxoAbastecimento, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      const fileName = `ASSINADO_${item.placa || item.cartao || "SOLICITACAO"}_${file.name}`;

      let fileUrl = dataUrl;

      if (gdriveWebhookUrl) {
        const toastId = toast.loading("Enviando PDF assinado para o Google Drive...");
        try {
          const resp = await fetch(gdriveWebhookUrl, {
            method: "POST",
            body: JSON.stringify({
              action: "upload_pdf",
              folderId: GDRIVE_FOLDER_ID,
              fileName,
              base64,
            }),
          });
          const json = await resp.json();
          if (json?.fileUrl) {
            fileUrl = json.fileUrl;
          }
          toast.dismiss(toastId);
        } catch (err) {
          toast.dismiss(toastId);
          console.error(err);
        }
      }

      const itemAtualizado: FluxoAbastecimento = {
        ...item,
        pdf_assinado_nome: file.name,
        pdf_assinado_url: fileUrl,
      };
      const novaLista = fluxos.map((f) => (f.id === item.id ? itemAtualizado : f));
      await salvarItemCompartilhado(itemAtualizado, novaLista);
      toast.success("PDF assinado anexado! Agora você já pode clicar em Aprovado.");
    };
    reader.readAsDataURL(file);
  };

  // 1. Criar Solicitação
  const handleCriarSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim() && !cartao.trim()) {
      toast.error("Informe a Placa ou o Cartão.");
      return;
    }
    const valorNum = Number(String(valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!justificativa.trim()) {
      toast.error("Informe a justificativa da solicitação.");
      return;
    }

    setSalvando(true);
    try {
      const projFinal =
        projeto.trim().toUpperCase() ||
        frotaMap.get(placa.trim().toUpperCase()) ||
        null;

      const novoItem: FluxoAbastecimento = {
        id: crypto.randomUUID(),
        placa: placa.trim().toUpperCase() || null,
        cartao: cartao.trim().toUpperCase() || null,
        projeto: projFinal,
        justificativa: justificativa.trim(),
        valor: valorNum,
        status: "solicitado",
        solicitado_por: userEmail || "adm@cymi.com.br",
        solicitado_em: new Date().toISOString(),
        aprovado_por: null,
        aprovado_em: null,
        recusado_por: null,
        recusado_em: null,
        motivo_recusa: null,
        feito_por: null,
        feito_em: null,
        pdf_assinado_nome: null,
        pdf_assinado_url: null,
        created_at: new Date().toISOString(),
      };

      const novaLista = [novoItem, ...fluxos];
      await salvarItemCompartilhado(novoItem, novaLista);

      toast.success("Solicitação criada! Baixe o PDF para assinatura do Gerente.");
      setPlaca("");
      setCartao("");
      setProjeto("");
      setValor("");
      setJustificativa("");
      setShowModal(false);
    } finally {
      setSalvando(false);
    }
  };

  // 2A. Aprovar Solicitação (Qualquer usuário/ADM com acesso ou Gerente/Master pode aprovar após anexar a autorização)
  const handleAprovar = async (item: FluxoAbastecimento) => {
    const itemAtualizado: FluxoAbastecimento = {
      ...item,
      status: "aprovado",
      aprovado_por: userEmail,
      aprovado_em: new Date().toISOString(),
      motivo_recusa: null,
    };
    const novaLista = fluxos.map((f) => (f.id === item.id ? itemAtualizado : f));
    await salvarItemCompartilhado(itemAtualizado, novaLista);
    toast.success("Solicitação APROVADA!");
  };

  // 2B. Recusar Solicitação (com opção de alterar o valor)
  const handleConfirmarRecusa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaRecusar) return;
    const valorAlterado = Number(String(novoValorRecusa).replace(",", "."));

    const itemAtualizado: FluxoAbastecimento = {
      ...itemParaRecusar,
      status: "recusado",
      valor: valorAlterado > 0 ? valorAlterado : itemParaRecusar.valor,
      recusado_por: userEmail,
      recusado_em: new Date().toISOString(),
      motivo_recusa: motivoRecusaInput.trim() || "Valor/solicitação recusada para ajuste",
    };

    const novaLista = fluxos.map((f) => (f.id === itemParaRecusar.id ? itemAtualizado : f));
    await salvarItemCompartilhado(itemAtualizado, novaLista);
    setItemParaRecusar(null);
    setMotivoRecusaInput("");
    setNovoValorRecusa("");
    toast.success("Solicitação marcada como RECUSADA para alteração de valor.");
  };

  // 2C. Alterar Valor e Reenviar
  const handleSalvarNovoValor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditarValor) return;
    const vNum = Number(String(valorEditadoInput).replace(",", "."));
    if (!vNum || vNum <= 0) {
      toast.error("Informe um novo valor válido.");
      return;
    }

    const itemAtualizado: FluxoAbastecimento = {
      ...itemEditarValor,
      valor: vNum,
      justificativa: justificativaEditadaInput.trim() || itemEditarValor.justificativa,
      status: "solicitado",
      solicitado_por: userEmail || itemEditarValor.solicitado_por,
      solicitado_em: new Date().toISOString(),
    };

    const novaLista = fluxos.map((f) => (f.id === itemEditarValor.id ? itemAtualizado : f));
    await salvarItemCompartilhado(itemAtualizado, novaLista);
    setItemEditarValor(null);
    toast.success("Valor atualizado!");
  };

  // 3. Master Marca como FEITO
  const handleMarcarFeito = async (item: FluxoAbastecimento) => {
    if (!podeMarcarFeito) {
      toast.error("Apenas o login principal (Master) pode marcar como Feito.");
      return;
    }
    const itemAtualizado: FluxoAbastecimento = {
      ...item,
      status: "feito",
      feito_por: userEmail,
      feito_em: new Date().toISOString(),
    };
    const novaLista = fluxos.map((f) => (f.id === item.id ? itemAtualizado : f));
    await salvarItemCompartilhado(itemAtualizado, novaLista);
    toast.success("Confirmado como FEITO!");
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Deseja excluir esta solicitação?")) return;
    const novaLista = fluxos.filter((f) => f.id !== id);
    setFluxos(novaLista);
    localStorage.setItem(STORAGE_FLUXOS_KEY, JSON.stringify(novaLista));
    await supabase.from("fluxos_abastecimento").delete().eq("id", id);
    toast.success("Solicitação removida.");
  };

  // Agora quem subiu a solicitação (ADM) também pode aprovar ou recusar, pois anexa a autorização assinada
  const podeAprovar = true;
  const podeMarcarFeito = isMaster || papelFluxo === "master";

  const fluxosFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return fluxos.filter((f) => {
      if (!isMaster && projetosPermitidos && projetosPermitidos.length > 0) {
        const isOwner = f.solicitado_por?.toLowerCase() === userEmail;
        const projMatch =
          !f.projeto ||
          projetosPermitidos.some((p) => p.toUpperCase() === f.projeto?.toUpperCase());
        if (!isOwner && !projMatch) return false;
      }

      if (filtroEtapa !== "todos" && f.status !== filtroEtapa) return false;

      if (!q) return true;
      return (
        (f.placa || "").toLowerCase().includes(q) ||
        (f.cartao || "").toLowerCase().includes(q) ||
        (f.projeto || "").toLowerCase().includes(q) ||
        (f.justificativa || "").toLowerCase().includes(q) ||
        (f.solicitado_por || "").toLowerCase().includes(q) ||
        (f.aprovado_por || "").toLowerCase().includes(q) ||
        (f.feito_por || "").toLowerCase().includes(q)
      );
    });
  }, [fluxos, isMaster, projetosPermitidos, userEmail, filtroEtapa, busca]);

  const colunas = useMemo(() => {
    return {
      solicitado: fluxosFiltrados.filter(
        (f) => f.status === "solicitado" || f.status === "recusado"
      ),
      aprovado: fluxosFiltrados.filter((f) => f.status === "aprovado"),
      feito: fluxosFiltrados.filter((f) => f.status === "feito"),
    };
  }, [fluxosFiltrados]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400 font-black uppercase tracking-widest animate-pulse">
        Carregando Fluxos...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-6 pb-20">
      {/* Cabeçalho */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-8 border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0b7336] to-[#298d4a] flex items-center justify-center text-white shadow-lg shrink-0">
            <ClipboardDocumentListIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
              Fluxos • Solicitação de Abastecimento
            </h1>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
              Logado como: <span className="text-[#0b7336] dark:text-green-400">{userEmail}</span> •{" "}
              <span className="uppercase font-black text-blue-600 dark:text-blue-400">
                Sincronizado em Tempo Real + Pasta Google Drive
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={GDRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all"
          >
            <FolderOpenIcon className="w-4 h-4" />
            Abrir Pasta Google Drive
          </a>

          {isMaster && (
            <button
              type="button"
              onClick={() => setShowConfigDrive(true)}
              className="flex items-center gap-1.5 px-3.5 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
              title="Conectar script da pasta Google Drive"
            >
              <Cog6ToothIcon className="w-4 h-4" />
              Sincronia Drive
            </button>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#0b7336] hover:bg-[#09602c] text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-green-600/20 transition-all active:scale-95"
          >
            <PlusIcon className="w-5 h-5" />
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtro */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar placa, cartão, e-mail, projeto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "todos", label: `Todos (${fluxosFiltrados.length})` },
            { id: "solicitado", label: `1. Solicitados (${colunas.solicitado.length})` },
            { id: "aprovado", label: `2. Aprovados (${colunas.aprovado.length})` },
            { id: "feito", label: `3. Feitos (${colunas.feito.length})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroEtapa(f.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                filtroEtapa === f.id
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow"
                  : "bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quadro das 3 Etapas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA 1: AGUARDANDO GERENTE / RECUSADOS PARA AJUSTE */}
        <div className="bg-amber-50/60 dark:bg-gray-800/50 border border-amber-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                1. Solicitação (Aguardando Gerente)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
              {colunas.solicitado.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.solicitado.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhuma solicitação pendente
              </p>
            ) : (
              colunas.solicitado.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onBaixarPdf={() => gerarPDFParaAssinatura(item)}
                  onUploadPdf={(file) => handleUploadPdfAssinado(item, file)}
                  onAprovar={() => handleAprovar(item)}
                  onRecusar={() => {
                    setItemParaRecusar(item);
                    setNovoValorRecusa(String(item.valor));
                    setMotivoRecusaInput("");
                  }}
                  onAlterarValor={() => {
                    setItemEditarValor(item);
                    setValorEditadoInput(String(item.valor));
                    setJustificativaEditadaInput(item.justificativa);
                  }}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 2: APROVADOS */}
        <div className="bg-blue-50/60 dark:bg-gray-800/50 border border-blue-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
                2. Aprovado (Aguardando Liberação)
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
              {colunas.aprovado.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.aprovado.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhum item aguardando liberação
              </p>
            ) : (
              colunas.aprovado.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onBaixarPdf={() => gerarPDFParaAssinatura(item)}
                  onUploadPdf={(file) => handleUploadPdfAssinado(item, file)}
                  onAprovar={() => handleAprovar(item)}
                  onRecusar={() => {
                    setItemParaRecusar(item);
                    setNovoValorRecusa(String(item.valor));
                    setMotivoRecusaInput("");
                  }}
                  onAlterarValor={() => {
                    setItemEditarValor(item);
                    setValorEditadoInput(String(item.valor));
                    setJustificativaEditadaInput(item.justificativa);
                  }}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 3: FEITO / CONCLUÍDO */}
        <div className="bg-emerald-50/60 dark:bg-gray-800/50 border border-emerald-200/70 dark:border-gray-700 rounded-3xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                3. Feito / Concluído
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
              {colunas.feito.length}
            </span>
          </div>

          <div className="space-y-3">
            {colunas.feito.length === 0 ? (
              <p className="text-center text-xs font-bold text-gray-400 py-10 uppercase">
                Nenhum fluxo finalizado
              </p>
            ) : (
              colunas.feito.map((item) => (
                <CardFluxo
                  key={item.id}
                  item={item}
                  podeAprovar={podeAprovar}
                  podeMarcarFeito={podeMarcarFeito}
                  isMaster={isMaster}
                  userEmail={userEmail}
                  onBaixarPdf={() => gerarPDFParaAssinatura(item)}
                  onUploadPdf={(file) => handleUploadPdfAssinado(item, file)}
                  onAprovar={() => handleAprovar(item)}
                  onRecusar={() => {}}
                  onAlterarValor={() => {}}
                  onFeito={() => handleMarcarFeito(item)}
                  onDelete={() => handleExcluir(item.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL NOVA SOLICITAÇÃO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase">
                Solicitar Abastecimento / Saldo
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
              Solicitante (ADM): <span className="font-black text-[#0b7336]">{userEmail}</span>
            </div>

            <form onSubmit={handleCriarSolicitacao} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Placa do Veículo
                  </label>
                  <input
                    type="text"
                    list="placas-frota-fluxo"
                    placeholder="Ex: ABC1D23"
                    value={placa}
                    onChange={(e) => handlePlacaChange(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                  <datalist id="placas-frota-fluxo">
                    {Array.from(frotaMap.keys()).map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Nº do Cartão (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Cartão ou final"
                    value={cartao}
                    onChange={(e) => setCartao(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Valor Solicitado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Projeto
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: EVOLTZ"
                    value={projeto}
                    onChange={(e) => setProjeto(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold uppercase text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Justificativa da Solicitação *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o motivo da solicitação de saldo/abastecimento..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 rounded-xl bg-[#0b7336] hover:bg-[#09602c] text-white font-black text-xs uppercase shadow-lg shadow-green-600/20"
                >
                  {salvando ? "Salvando..." : "Criar Solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECUSAR SOLICITAÇÃO */}
      {itemParaRecusar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-red-600 uppercase">
                Recusar / Ajustar Valor
              </h3>
              <button
                type="button"
                onClick={() => setItemParaRecusar(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleConfirmarRecusa} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Alterar Valor Solicitado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={novoValorRecusa}
                  onChange={(e) => setNovoValorRecusa(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Motivo da Recusa / Observação
                </label>
                <textarea
                  rows={3}
                  placeholder="Informe o motivo da recusa ou o valor autorizado..."
                  value={motivoRecusaInput}
                  onChange={(e) => setMotivoRecusaInput(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setItemParaRecusar(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase shadow-lg"
                >
                  Confirmar Recusa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALTERAR VALOR PELO SOLICITANTE */}
      {itemEditarValor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase">
                Alterar Valor Solicitado
              </h3>
              <button
                type="button"
                onClick={() => setItemEditarValor(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoValor} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Novo Valor Solicitado (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorEditadoInput}
                  onChange={(e) => setValorEditadoInput(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                  Justificativa
                </label>
                <textarea
                  rows={3}
                  required
                  value={justificativaEditadaInput}
                  onChange={(e) => setJustificativaEditadaInput(e.target.value)}
                  className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0b7336]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setItemEditarValor(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#0b7336] hover:bg-[#09602c] text-white font-black text-xs uppercase shadow-lg"
                >
                  Salvar e Reenviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR GOOGLE DRIVE WEBHOOK */}
      {showConfigDrive && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 dark:text-white uppercase">
                Integração Direta com a Pasta do Google Drive
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigDrive(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Pasta vinculada:{" "}
              <a
                href={GDRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-bold"
              >
                {GDRIVE_FOLDER_ID}
              </a>
              . Cole abaixo a URL do Web App do arquivo{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded">google_drive_fluxos_script.js</code>{" "}
              para enviar uma cópia dos PDFs assinados automaticamente para sua pasta do Drive.
            </p>

            <form onSubmit={handleSalvarWebhook} className="space-y-3">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigDrive(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs uppercase"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase"
                >
                  Salvar Conexão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CardFluxo({
  item,
  podeAprovar,
  podeMarcarFeito,
  isMaster,
  userEmail,
  onBaixarPdf,
  onUploadPdf,
  onAprovar,
  onRecusar,
  onAlterarValor,
  onFeito,
  onDelete,
}: {
  item: FluxoAbastecimento;
  podeAprovar: boolean;
  podeMarcarFeito: boolean;
  isMaster: boolean;
  userEmail: string;
  onBaixarPdf: () => void;
  onUploadPdf: (file: File) => void;
  onAprovar: () => void;
  onRecusar: () => void;
  onAlterarValor: () => void;
  onFeito: () => void;
  onDelete: () => void;
}) {
  const isRecusado = item.status === "recusado";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-2xl p-4 border shadow-sm space-y-3 ${
        isRecusado
          ? "border-red-300 dark:border-red-700 ring-1 ring-red-200"
          : "border-gray-100 dark:border-gray-700"
      }`}
    >
      {/* Topo: Placa / Cartão / Status Recusado / Valor */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.placa && (
            <span className="px-2.5 py-1 rounded-lg bg-gray-900 text-white font-black text-xs uppercase flex items-center gap-1">
              <TruckIcon className="w-3.5 h-3.5" /> {item.placa}
            </span>
          )}
          {item.cartao && (
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black text-xs uppercase flex items-center gap-1">
              <CreditCardIcon className="w-3.5 h-3.5" /> {item.cartao}
            </span>
          )}
          {item.projeto && (
            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black text-[10px] uppercase">
              {item.projeto}
            </span>
          )}
          {isRecusado && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-black text-[10px] uppercase">
              Recusado
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-base font-black ${
              isRecusado ? "text-red-600" : "text-[#0b7336] dark:text-green-400"
            }`}
          >
            {fmtCurrency(item.valor)}
          </span>
          {(item.status === "solicitado" || item.status === "recusado") && (
            <button
              type="button"
              onClick={onAlterarValor}
              title="Alterar valor solicitado"
              className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300"
            >
              <PencilSquareIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Justificativa */}
      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/70 text-xs font-semibold text-gray-700 dark:text-gray-200 break-words">
        {item.justificativa}
      </div>

      {/* Motivo da Recusa */}
      {isRecusado && item.motivo_recusa && (
        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
          Motivo da Recusa: {item.motivo_recusa}
          <button
            type="button"
            onClick={onAlterarValor}
            className="mt-2 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider"
          >
            Alterar Valor Solicitado e Reenviar
          </button>
        </div>
      )}

      {/* Área de PDF (1. Baixar PDF p/ Gerente Assinar | 2. Subir PDF Assinado) */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onBaixarPdf}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 text-[10px] font-black uppercase tracking-wider transition-all"
        >
          <DocumentArrowDownIcon className="w-4 h-4 text-[#0b7336] shrink-0" />
          <span>Baixar PDF</span>
        </button>

        <label className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all">
          <DocumentArrowUpIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {item.pdf_assinado_nome ? "Trocar Assinado" : "Subir Assinado"}
          </span>
          <input
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadPdf(f);
            }}
          />
        </label>
      </div>

      {/* Indicador de PDF Assinado Anexado */}
      {item.pdf_assinado_url && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-[11px]">
          <span className="font-black text-emerald-700 dark:text-emerald-300 truncate">
            ✅ Assinado: {item.pdf_assinado_nome}
          </span>
          <a
            href={item.pdf_assinado_url}
            target="_blank"
            rel="noopener noreferrer"
            download={item.pdf_assinado_nome || "Solicitacao_Assinada.pdf"}
            className="flex items-center gap-1 font-black text-blue-600 underline shrink-0 ml-2"
          >
            <EyeIcon className="w-3.5 h-3.5" /> Abrir
          </a>
        </div>
      )}

      {/* Auditoria de quem executou cada etapa */}
      <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-black uppercase text-amber-600">1. Solicitado por:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {item.solicitado_por}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 text-right">{fmtDateTime(item.solicitado_em)}</div>

        {isRecusado ? (
          <>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="font-black uppercase text-red-600">2. Recusado por:</span>
              <span className="font-bold text-red-600 truncate">{item.recusado_por}</span>
            </div>
            <div className="text-[10px] text-gray-400 text-right">
              {fmtDateTime(item.recusado_em)}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="font-black uppercase text-blue-600">2. Aprovado por:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
                {item.aprovado_por || "Aguardando aprovação"}
              </span>
            </div>
            {item.aprovado_em && (
              <div className="text-[10px] text-gray-400 text-right">
                {fmtDateTime(item.aprovado_em)}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-black uppercase text-emerald-600">3. Feito por:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
            {item.feito_por || "Aguardando confirmação"}
          </span>
        </div>
        {item.feito_em && (
          <div className="text-[10px] text-gray-400 text-right">{fmtDateTime(item.feito_em)}</div>
        )}
      </div>

      {/* Botões Aprovado / Recusado (liberados para o solicitante/ADM e gerente) + Marcar Feito (somente Master) */}
      <div className="flex items-center gap-2 pt-2">
        {(item.status === "solicitado" || item.status === "recusado") && podeAprovar && (
          <>
            <button
              type="button"
              onClick={onAprovar}
              className="flex-1 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all"
            >
              <CheckCircleIcon className="w-4 h-4 shrink-0" />
              Aprovado
            </button>
            <button
              type="button"
              onClick={onRecusar}
              className="flex-1 py-2.5 px-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
            >
              <XCircleIcon className="w-4 h-4 shrink-0" />
              Recusado
            </button>
          </>
        )}

        {item.status === "aprovado" && podeMarcarFeito && (
          <button
            type="button"
            onClick={onFeito}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <CheckBadgeIcon className="w-4 h-4" />
            Marcar como Feito
          </button>
        )}

        {(isMaster ||
          ((item.status === "solicitado" || item.status === "recusado") &&
            item.solicitado_por === userEmail)) && (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 shrink-0 ml-auto"
            title="Excluir solicitação"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
