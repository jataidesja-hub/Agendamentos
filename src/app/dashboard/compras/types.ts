// =============================================
// TIPOS: GESTÃO DE COMPRAS
// =============================================

export const CATEGORIAS = [
  "FRETES E CARRETOS",
  "INFORMATICA",
  "UNIFORMES",
  "MANUT. MAQ. EQUIP.",
  "EPI",
  "CONSULTORIA",
  "ESCRITORIO",
  "LINHA VIVA",
  "RH",
  "SEGURANÇA",
  "VEICULOS",
  "CARPITARIA E SERRALHERIA",
  "CANTINA CANTEIRO",
  "DEDETIZAÇÃO, LIMPEZAS",
  "ATIVO FIXO",
  "ANALISES LABORATORIAIS",
  "TREINAMENTOS",
  "FERRAMENTAS",
  "ALUGUEL MAQUINAS E EQUIP. - PJ",
  "GRAFICA",
] as const;

export const UNIDADES = ["UND", "SV", "MÊS", "KG", "L", "CX", "PCT"] as const;

export const STATUS_COMPRA = [
  "EM COTAÇÃO",
  "EM APROVAÇÃO",
  "PCBS EM APROVAÇÃO",
  "PENDENTE APROVAÇÃO",
  "COMPARATIVO",
  "ABRIR REQUISIÇÃO",
  "CONVERTER REQUISIÇÃO",
  "PROCESSO COM RJ",
  "LIBERADO",
  "PEDIDO EMITIDO",
  "RECEBIDO",
  "CANCELADO",
] as const;

export const PRAZOS = ["IMEDIATO", "7 DIAS", "15 DIAS", "30 DIAS", "45 DIAS", "60 DIAS"] as const;

export const CONDICOES_PAGAMENTO = [
  "À VISTA",
  "7 DIAS",
  "15 DIAS",
  "30 DIAS",
  "30/60",
  "30/60/90",
] as const;

export const CENTROS_CUSTO = [
  "CENTRO OPERACIONAL",
  "O&M COMISIONADO MANTIQUEIRA",
  "O&M SERENA - DELTA MARANHÃO",
  "O&M ELETROBRAS ELETROSUL",
  "55221BS",
  "55251BS",
  "55250BS",
] as const;

export type StatusCompra = (typeof STATUS_COMPRA)[number];

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
  contato?: string;
  email?: string;
  telefone?: string;
  categorias?: string[];
  ativo: boolean;
  created_at: string;
}

export interface Cotacao {
  id?: string;
  processo_id?: string;
  numero_cotacao: 1 | 2 | 3;
  fornecedor_id?: string;
  fornecedor_nome: string;
  preco?: number | null;
  prazo?: string;
  condicao_pagamento?: string;
  validade_cotacao?: string;
  observacoes?: string;
  selecionada?: boolean;
}

export interface Processo {
  id: string;
  numero_processo?: string;
  numero_requisicao?: string;
  numero_pedido?: string;
  status: StatusCompra;
  centro_custo: string;
  projeto?: string;
  produto_id?: string;
  produto_nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  responsavel_compra: string;
  solicitante?: string;
  data_pedido: string;
  fornecedor_escolhido_id?: string;
  fornecedor_escolhido_nome?: string;
  preco_escolhido?: number;
  observacoes?: string;
  created_at: string;
  cotacoes?: Cotacao[];
}

export const STATUS_CONFIG: Record<StatusCompra, { label: string; color: string; bg: string; border: string; dot: string }> = {
  "EM COTAÇÃO": {
    label: "Em Cotação",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/30",
    dot: "bg-blue-400",
  },
  "EM APROVAÇÃO": {
    label: "Em Aprovação",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
    dot: "bg-amber-400",
  },
  "PCBS EM APROVAÇÃO": {
    label: "PCBS Em Aprovação",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-500/30",
    dot: "bg-orange-400",
  },
  "PENDENTE APROVAÇÃO": {
    label: "Pendente Aprovação",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
    border: "border-yellow-200 dark:border-yellow-500/30",
    dot: "bg-yellow-400",
  },
  "COMPARATIVO": {
    label: "Comparativo",
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/30",
    dot: "bg-violet-400",
  },
  "ABRIR REQUISIÇÃO": {
    label: "Abrir Requisição",
    color: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-500/10",
    border: "border-sky-200 dark:border-sky-500/30",
    dot: "bg-sky-400",
  },
  "CONVERTER REQUISIÇÃO": {
    label: "Converter Requisição",
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    border: "border-cyan-200 dark:border-cyan-500/30",
    dot: "bg-cyan-400",
  },
  "PROCESSO COM RJ": {
    label: "Processo c/ RJ",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/30",
    dot: "bg-red-400",
  },
  "LIBERADO": {
    label: "Liberado",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  "PEDIDO EMITIDO": {
    label: "Pedido Emitido",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/30",
    dot: "bg-purple-400",
  },
  "RECEBIDO": {
    label: "Recebido",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-500/10",
    border: "border-teal-200 dark:border-teal-500/30",
    dot: "bg-teal-400",
  },
  "CANCELADO": {
    label: "Cancelado",
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-500/10",
    border: "border-gray-200 dark:border-gray-500/30",
    dot: "bg-gray-400",
  },
};
