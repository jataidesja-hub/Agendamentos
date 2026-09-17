"use client";

import React, { useState, useMemo } from 'react';
import { DocumentArrowDownIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface Props {
  abastecimentos: any[];
  availableMonths: string[];
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  labels: string[], values: number[],
  title: string, color: string
) {
  if (!values.length) return;
  const max = Math.max(...values, 0.01);
  const barW = Math.min(40, (w - 60) / labels.length - 8);
  const gap = (w - 60) / labels.length;

  // Title
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(title, x, y - 6);

  // Axes
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y + h);
  ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
  ctx.stroke();

  // Bars
  labels.forEach((lbl, i) => {
    const bx = x + i * gap + gap / 2 - barW / 2;
    const bh = (values[i] / max) * (h - 20);
    const by = y + h - bh;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, bh, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = '#6b7280';
    ctx.font = '7px Arial';
    ctx.textAlign = 'center';
    const shortLbl = lbl.length > 8 ? lbl.substring(0, 8) + '…' : lbl;
    ctx.fillText(shortLbl, bx + barW / 2, y + h + 10);

    // Value
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 7px Arial';
    ctx.fillText(
      values[i].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      bx + barW / 2, by - 3
    );
  });
  ctx.textAlign = 'left';
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  labels: string[], values: number[],
  title: string, color: string
) {
  if (values.length < 2) return;
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values);
  const range = max - min || 1;

  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 11px Arial';
  ctx.fillText(title, x, y - 6);

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y + h);
  ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h);
  ctx.stroke();

  const pts = labels.map((_, i) => ({
    px: x + (i / (labels.length - 1)) * w,
    py: y + h - ((values[i] - min) / range) * (h - 20)
  }));

  // Fill
  ctx.beginPath();
  ctx.moveTo(pts[0].px, y + h);
  pts.forEach(p => ctx.lineTo(p.px, p.py));
  ctx.lineTo(pts[pts.length - 1].px, y + h);
  ctx.closePath();
  ctx.fillStyle = color + '22';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
  ctx.stroke();

  // Points + labels
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.px, p.py, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#6b7280';
    ctx.font = '7px Arial';
    ctx.textAlign = 'center';
    const shortLbl = labels[i].slice(5); // MM/YYYY -> MM
    ctx.fillText(shortLbl, p.px, y + h + 10);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 7px Arial';
    ctx.fillText(values[i].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), p.px, p.py - 6);
  });
  ctx.textAlign = 'left';
}

export default function RelatorioPDFButton({ abastecimentos, availableMonths }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const toggleMonth = (m: string) => {
    setSelectedMonths(prev => {
      const n = new Set(prev);
      n.has(m) ? n.delete(m) : n.add(m);
      return n;
    });
  };

  const sortedSelected = useMemo(
    () => Array.from(selectedMonths).sort(),
    [selectedMonths]
  );

  const generatePDF = async () => {
    if (selectedMonths.size === 0) {
      toast.error('Selecione ao menos um mês.');
      return;
    }
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');

      // --- Processamento de dados ---
      const normalize = (p: string) => p?.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim() || '';

      // Busca projeto por placa na frota
      const { data: frotaData } = await supabase.from('frota_veiculos').select('placa, projeto').eq('status', 'Ativo');
      const placaToProject = new Map<string, string>();
      (frotaData || []).forEach((v: any) => {
        if (v.projeto) placaToProject.set(normalize(v.placa), String(v.projeto).toUpperCase().trim());
      });

      const monthData = sortedSelected.map(month => {
        const items = abastecimentos.filter(a => String(a.data_transacao).slice(0, 7) === month);
        const totalLitros = items.reduce((s, a) => s + (Number(a.litros) || 0), 0);
        const totalValor = items.reduce((s, a) => s + (Number(a.valor_emissao) || 0), 0);
        const precoMedio = totalLitros > 0 ? totalValor / totalLitros : 0;

        // Economia por projeto — soma só os abastecimentos mais baratos que a média
        const porProjeto: Record<string, { economizado: number, litros: number, valor: number }> = {};
        items.forEach(a => {
          const preco = Number(a.valor_litro) || 0;
          const litros = Number(a.litros) || 0;
          if (!preco || !litros) return;
          const saving = (precoMedio - preco) * litros;
          if (saving <= 0) return; // ignora abastecimentos acima da média
          const proj = String(a.projeto || 'SEM PROJETO').toUpperCase();
          if (!porProjeto[proj]) porProjeto[proj] = { economizado: 0, litros: 0, valor: 0 };
          porProjeto[proj].economizado += saving;
          porProjeto[proj].litros += litros;
          porProjeto[proj].valor += Number(a.valor_emissao) || 0;
        });

        const totalEconomizado = Object.values(porProjeto).reduce((s, v) => s + v.economizado, 0);

        return { month, items, totalLitros, totalValor, precoMedio, porProjeto, totalEconomizado };
      });

      // Projeção linear simples (regressão dos últimos meses)
      const economias = monthData.map(m => m.totalEconomizado);
      const avgEconomy = economias.reduce((s, v) => s + v, 0) / (economias.length || 1);
      const trend = economias.length > 1
        ? (economias[economias.length - 1] - economias[0]) / (economias.length - 1)
        : 0;
      const projNextMonth = Math.max(0, economias[economias.length - 1] + trend);
      const proj3Months = Math.max(0, economias[economias.length - 1] + trend * 3);

      // --- PDF ---
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 40;

      const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const fmtMonth = (m: string) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      let page = 1;
      const addHeader = (title: string) => {
        doc.setFillColor(11, 115, 54);
        doc.rect(0, 0, PW, 56, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('CYMI — Relatório Analítico de Abastecimento', M, 24);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(title, M, 40);
        doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}  •  Página ${page}`, PW - M, 40, { align: 'right' });
        doc.setTextColor(31, 41, 55);
      };

      const addFooter = () => {
        doc.setFillColor(243, 244, 246);
        doc.rect(0, PH - 28, PW, 28, 'F');
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text('Relatório gerado automaticamente pelo sistema CYMI Gerenciamentos. Dados sujeitos a conferência.', M, PH - 12);
      };

      // --- PÁGINA 1: Capa + Sumário ---
      addHeader('Período: ' + sortedSelected.map(fmtMonth).join(', '));

      // Capa: Resumo executivo
      let cy = 80;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('RESUMO EXECUTIVO', M, cy);
      cy += 18;

      doc.setDrawColor(11, 115, 54);
      doc.setLineWidth(1);
      doc.line(M, cy, PW - M, cy);
      cy += 16;

      const totalGeralLitros = monthData.reduce((s, m) => s + m.totalLitros, 0);
      const totalGeralValor = monthData.reduce((s, m) => s + m.totalValor, 0);
      const totalGeralEcon = monthData.reduce((s, m) => s + m.totalEconomizado, 0);
      const precoMedioGeral = totalGeralLitros > 0 ? totalGeralValor / totalGeralLitros : 0;

      const mapUFtoRegiao = (uf: string) => {
        const SUL = ['PR', 'SC', 'RS'];
        const SUDESTE = ['SP', 'RJ', 'MG', 'ES'];
        const CO = ['MS', 'MT', 'GO', 'DF'];
        const NE = ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'];
        const NORTE = ['AM', 'RR', 'AP', 'PA', 'TO', 'RO', 'AC'];
        if (SUL.includes(uf)) return 'Sul';
        if (SUDESTE.includes(uf)) return 'Sudeste';
        if (CO.includes(uf)) return 'Centro-Oeste';
        if (NE.includes(uf)) return 'Nordeste';
        if (NORTE.includes(uf)) return 'Norte';
        return 'Outros';
      };

      const allSelectedItems = abastecimentos.filter(a => sortedSelected.includes(String(a.data_transacao).slice(0, 7)));
      const precoPorRegiao: Record<string, { valor: number, litros: number }> = {};
      const precoPorRegiaoCombustivel: Record<string, Record<string, { valor: number, litros: number }>> = {};
      const consumoPorProjeto: Record<string, number> = {};
      // proj -> mes -> { valor, litros }
      const consumoPorProjetoMes: Record<string, Record<string, { valor: number, litros: number }>> = {};

      allSelectedItems.forEach(a => {
        const valorEmissao = Number(a.valor_emissao) || 0;
        const litros = Number(a.litros) || 0;
        
        let uf = String(a.uf || a.estado || '').toUpperCase().trim();
        if (!uf && a.cidade && typeof a.cidade === 'string' && a.cidade.includes('/')) {
          uf = a.cidade.split('/').pop()?.toUpperCase().trim() || '';
        }
        const regiao = mapUFtoRegiao(uf);
        if (!precoPorRegiao[regiao]) precoPorRegiao[regiao] = { valor: 0, litros: 0 };
        precoPorRegiao[regiao].valor += valorEmissao;
        precoPorRegiao[regiao].litros += litros;

        // Por tipo de combustível dentro de cada região
        const combustivel = String(a.tipo_combustivel || 'NÃO INFORMADO').toUpperCase().trim();
        if (!precoPorRegiaoCombustivel[regiao]) precoPorRegiaoCombustivel[regiao] = {};
        if (!precoPorRegiaoCombustivel[regiao][combustivel]) precoPorRegiaoCombustivel[regiao][combustivel] = { valor: 0, litros: 0 };
        precoPorRegiaoCombustivel[regiao][combustivel].valor += valorEmissao;
        precoPorRegiaoCombustivel[regiao][combustivel].litros += litros;

        const proj = String(a.projeto || placaToProject.get(normalize(String(a.placa || ''))) || 'SEM PROJETO').toUpperCase();
        if (proj !== 'SEM PROJETO') {
          consumoPorProjeto[proj] = (consumoPorProjeto[proj] || 0) + valorEmissao;

          const mes = String(a.data_transacao).slice(0, 7);
          if (!consumoPorProjetoMes[proj]) consumoPorProjetoMes[proj] = {};
          if (!consumoPorProjetoMes[proj][mes]) consumoPorProjetoMes[proj][mes] = { valor: 0, litros: 0 };
          consumoPorProjetoMes[proj][mes].valor += valorEmissao;
          consumoPorProjetoMes[proj][mes].litros += litros;
        }
      });

      const mediasRegiao = Object.entries(precoPorRegiao)
        .map(([regiao, v]) => ({ regiao, media: v.litros > 0 ? v.valor / v.litros : 0 }))
        .sort((a, b) => b.media - a.media);

      const top5Consumidores = Object.entries(consumoPorProjeto)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      const cards = [
        { label: 'Total Abastecido', value: fmt(totalGeralValor), sub: `${totalGeralLitros.toFixed(0)} L`, color: [11, 115, 54] },
        { label: 'Total Economizado', value: fmt(totalGeralEcon), sub: 'vs preço médio', color: [16, 185, 129] },
        { label: 'Preço Médio Geral', value: `${precoMedioGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L`, sub: 'todos os meses', color: [99, 102, 241] },
        { label: 'Média Mensal Economiz.', value: fmt(avgEconomy), sub: 'por mês selecionado', color: [245, 158, 11] },
      ];

      const cardW = (PW - 2 * M - 12) / 4;
      cards.forEach((c, i) => {
        const cx = M + i * (cardW + 4);
        doc.setFillColor(c.color[0], c.color[1], c.color[2]);
        doc.roundedRect(cx, cy, cardW, 54, 6, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(c.label.toUpperCase(), cx + 8, cy + 14);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(c.value, cx + 8, cy + 32, { maxWidth: cardW - 12 });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(c.sub, cx + 8, cy + 46);
      });
      cy += 70;
      doc.setTextColor(31, 41, 55);

      // Projeções
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('PROJEÇÕES (Tendência Linear)', M, cy);
      cy += 16;
      doc.setDrawColor(11, 115, 54);
      doc.line(M, cy, PW - M, cy);
      cy += 14;
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const projRows = [
        [`Próximo mês (${fmtMonth(sortedSelected[sortedSelected.length - 1])})`, fmt(projNextMonth), trend >= 0 ? 'Tendência de crescimento na economia' : 'Tendência de redução — atenção necessária'],
        ['Próximos 3 meses (acumulado)', fmt(proj3Months), 'Projeção baseada na tendência dos meses selecionados'],
        ['Economia anualizada (extrapol.)', fmt(avgEconomy * 12), 'Se a média dos períodos se mantiver'],
      ];

      projRows.forEach(r => {
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(M, cy, PW - 2 * M, 28, 4, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(r[0], M + 8, cy + 11);
        doc.setTextColor(11, 115, 54);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(r[1], M + 8, cy + 23);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text(r[2], PW / 2, cy + 17, { maxWidth: PW / 2 - M - 10 });
        doc.setTextColor(31, 41, 55);
        cy += 32;
      });

      cy += 12;

      // Economia por mês (tabela)
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('CONSOLIDADO POR MÊS', M, cy);
      cy += 16;
      doc.setDrawColor(11, 115, 54);
      doc.line(M, cy, PW - M, cy);
      cy += 12;

      // Header da tabela
      const cols = [140, 100, 90, 90, 95];
      const headers = ['Mês', 'Litros', 'Valor Total', 'Preço Médio/L', 'Economizado'];
      let cx2 = M;
      doc.setFillColor(17, 24, 39);
      doc.rect(M, cy, PW - 2 * M, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((h, i) => {
        doc.text(h, cx2 + 6, cy + 13);
        cx2 += cols[i];
      });
      cy += 20;

      monthData.forEach((m, idx) => {
        doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
        doc.rect(M, cy, PW - 2 * M, 18, 'F');
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'normal');
        let cx3 = M;
        const row = [
          fmtMonth(m.month),
          m.totalLitros.toFixed(0) + ' L',
          fmt(m.totalValor),
          fmt(m.precoMedio) + '/L',
          fmt(m.totalEconomizado),
        ];
        row.forEach((v, i) => {
          if (i === 4) { doc.setTextColor(11, 115, 54); doc.setFont('helvetica', 'bold'); }
          doc.text(v, cx3 + 6, cy + 12);
          doc.setTextColor(31, 41, 55);
          doc.setFont('helvetica', 'normal');
          cx3 += cols[i];
        });
        cy += 18;
      });
      cy += 10;

      if (cy > PH - 150) {
        addFooter();
        doc.addPage();
        page++;
        addHeader('Análise Complementar');
        cy = 80;
      } else {
        cy += 10;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('TOP 5 MAIORES CONSUMOS', M, cy);
      cy += 12;
      doc.setDrawColor(11, 115, 54);
      doc.setLineWidth(1);
      doc.line(M, cy, PW - M, cy);
      cy += 16;

      if (top5Consumidores.length === 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Nenhum projeto identificado no período selecionado.', M, cy);
        cy += 16;
      } else {
        top5Consumidores.forEach(([proj, val], idx) => {
          doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
          doc.rect(M, cy - 10, PW - 2 * M, 16, 'F');
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(31, 41, 55);
          const projName = proj.length > 50 ? proj.substring(0, 50) + '...' : proj;
          doc.text(projName, M + 6, cy);
          doc.setTextColor(220, 38, 38);
          doc.text(val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), PW - M - 6, cy, { align: 'right' });
          cy += 18;
        });
      }
      cy += 14;

      // --- CONSUMO POR PROJETO / MÊS ---
      // Nova página para esta seção
      addFooter();
      doc.addPage();
      page++;
      addHeader('Consumo por Projeto / Mês');
      cy = 80;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('CONSUMO POR PROJETO / MÊS', M, cy);
      cy += 12;
      doc.setDrawColor(11, 115, 54);
      doc.setLineWidth(1);
      doc.line(M, cy, PW - M, cy);
      cy += 14;

      // Cabeçalho da tabela: Projeto | Mês1 | Mês2 | Mês3 | Total (últimos 3 meses)
      const projsSorted = Object.keys(consumoPorProjetoMes).sort((a, b) =>
        (consumoPorProjeto[b] || 0) - (consumoPorProjeto[a] || 0)
      );
      const mesesSorted = [...sortedSelected].sort().slice(-3);
      const colProjW = 130;
      const colMesW = mesesSorted.length > 0 ? Math.min(70, (PW - 2 * M - colProjW - 60) / mesesSorted.length) : 70;
      const colTotalW = 65;

      // Header row
      doc.setFillColor(17, 24, 39);
      doc.rect(M, cy, PW - 2 * M, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('PROJETO', M + 4, cy + 13);
      mesesSorted.forEach((mes, i) => {
        const label = new Date(mes + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
        doc.text(label, M + colProjW + i * colMesW + colMesW / 2, cy + 13, { align: 'center' });
      });
      doc.text('TOTAL', M + colProjW + mesesSorted.length * colMesW + colTotalW / 2, cy + 13, { align: 'center' });
      cy += 20;

      projsSorted.forEach((proj, idx) => {
        if (cy > PH - 50) {
          addFooter();
          doc.addPage();
          page++;
          addHeader('Consumo por Projeto / Mês (continuação)');
          cy = 80;
          // Reimprime cabeçalho
          doc.setFillColor(17, 24, 39);
          doc.rect(M, cy, PW - 2 * M, 20, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('PROJETO', M + 4, cy + 13);
          mesesSorted.forEach((mes, i) => {
            const label = new Date(mes + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
            doc.text(label, M + colProjW + i * colMesW + colMesW / 2, cy + 13, { align: 'center' });
          });
          doc.text('TOTAL', M + colProjW + mesesSorted.length * colMesW + colTotalW / 2, cy + 13, { align: 'center' });
          cy += 20;
        }

        const rowH = 16;
        doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
        doc.rect(M, cy, PW - 2 * M, rowH, 'F');

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        const projLabel = proj.length > 22 ? proj.substring(0, 22) + '…' : proj;
        doc.text(projLabel, M + 4, cy + 11);

        let totalProjVal = 0;
        mesesSorted.forEach((mes, i) => {
          const v = consumoPorProjetoMes[proj]?.[mes]?.valor || 0;
          totalProjVal += v;
          const xCenter = M + colProjW + i * colMesW + colMesW / 2;
          doc.setFont('helvetica', v > 0 ? 'bold' : 'normal');
          doc.setTextColor(v > 0 ? 31 : 156, v > 0 ? 41 : 163, v > 0 ? 55 : 175);
          doc.text(v > 0 ? fmt(v) : '—', xCenter, cy + 11, { align: 'center' });
        });

        // Total
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(11, 115, 54);
        const xTotal = M + colProjW + mesesSorted.length * colMesW + colTotalW / 2;
        doc.text(fmt(totalProjVal), xTotal, cy + 11, { align: 'center' });

        cy += rowH;
      });

      cy += 14;

      // Preço Médio/Região sempre em página nova
      addFooter();
      doc.addPage();
      page++;
      addHeader('Preço Médio / Região');
      cy = 80;

      // --- PREÇO MÉDIO / REGIÃO (largura total) ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 115, 54);
      doc.text('PREÇO MÉDIO / REGIÃO', M, cy);
      cy += 12;
      doc.setDrawColor(11, 115, 54);
      doc.setLineWidth(1);
      doc.line(M, cy, PW - M, cy);
      cy += 16;

      mediasRegiao.forEach((mr) => {
        // Quebra de página automática
        if (cy > PH - 60) {
          addFooter();
          doc.addPage();
          page++;
          addHeader('Preço Médio / Região (continuação)');
          cy = 80;
        }

        // Cabeçalho da região
        doc.setFillColor(243, 244, 246);
        doc.rect(M, cy - 10, PW - 2 * M, 16, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(mr.regiao, M + 6, cy);
        doc.setTextColor(11, 115, 54);
        doc.text(mr.media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), PW - M - 6, cy, { align: 'right' });
        cy += 14;

        // Sub-linhas por tipo de combustível
        const combsNaRegiao = precoPorRegiaoCombustivel[mr.regiao] || {};
        const combsSorted = Object.entries(combsNaRegiao)
          .map(([comb, v]) => ({ comb, media: v.litros > 0 ? v.valor / v.litros : 0 }))
          .sort((a, b) => b.media - a.media);
        combsSorted.forEach(({ comb, media }) => {
          if (cy > PH - 40) {
            addFooter();
            doc.addPage();
            page++;
            addHeader('Preço Médio / Região (continuação)');
            cy = 80;
          }
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          const combLabel = '      ' + (comb.length > 50 ? comb.substring(0, 50) + '…' : comb);
          doc.text(combLabel, M, cy);
          doc.setTextColor(11, 115, 54);
          doc.setFont('helvetica', 'bold');
          doc.text(media.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), PW - M - 6, cy, { align: 'right' });
          cy += 11;
        });
        cy += 6;
      });

      cy += 10;

      addFooter();

      // --- PÁGINA: Gráficos ---
      doc.addPage();
      page++;
      addHeader('Análise Visual — Gráficos');
      cy = 75;

      // Canvas para gráficos
      const canvas = document.createElement('canvas');
      canvas.width = 900; canvas.height = 700;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gráfico 1: Economia por mês (linha)
      drawLineChart(ctx, 40, 40, 380, 180,
        monthData.map(m => m.month),
        monthData.map(m => m.totalEconomizado),
        'Economia por Mês (R$)', '#0b7336'
      );

      // Gráfico 2: Preço médio por mês (linha)
      drawLineChart(ctx, 480, 40, 380, 180,
        monthData.map(m => m.month),
        monthData.map(m => m.precoMedio),
        'Preço Médio por Litro (R$)', '#6366f1'
      );

      // Gráfico 3: Total abastecido por mês (barras)
      drawBarChart(ctx, 40, 300, 380, 180,
        monthData.map(m => m.month),
        monthData.map(m => m.totalValor),
        'Total Abastecido por Mês (R$)', '#10b981'
      );

      // Gráfico 4: Projeção (barras com histórico + proj)
      const projLabels = [...monthData.map(m => m.month), 'Próx. Mês'];
      const projValues = [...monthData.map(m => m.totalEconomizado), projNextMonth];
      drawBarChart(ctx, 480, 300, 380, 180,
        projLabels, projValues,
        'Economia + Projeção (R$)', '#f59e0b'
      );

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', M, cy, PW - 2 * M, (PW - 2 * M) * 0.75);
      cy += (PW - 2 * M) * 0.75 + 16;

      // Análise textual
      if (cy < PH - 120) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        const analysis = trend >= 0
          ? `✔ A tendência de economia está em crescimento (+${fmt(trend)}/mês), indicando que a estratégia de seleção de postos mais baratos está gerando resultados positivos. Recomenda-se manter a política de monitoramento e aprovação de postos.`
          : `⚠ A tendência de economia está em declínio (${fmt(trend)}/mês). Recomenda-se revisão dos postos conveniados, renegociação de preços e maior controle sobre as autorizações de abastecimento fora da rede preferencial.`;
        const lines = doc.splitTextToSize(analysis, PW - 2 * M);
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(M, cy, PW - 2 * M, lines.length * 12 + 14, 6, 6, 'F');
        doc.text(lines, M + 8, cy + 12);
      }

      addFooter();

      // Salva
      const periodoStr = sortedSelected.length === 1
        ? fmtMonth(sortedSelected[0])
        : `${fmtMonth(sortedSelected[0])}_a_${fmtMonth(sortedSelected[sortedSelected.length - 1])}`;
      doc.save(`Relatorio_Eficiencia_${periodoStr.replace(/\s/g, '_')}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar PDF: ' + err.message);
    } finally {
      setGenerating(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all"
      >
        <DocumentArrowDownIcon className="w-4 h-4" /> RELATÓRIO PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Gerar Relatório PDF</h3>
                <p className="text-xs text-gray-500 mt-1">Selecione os meses para incluir no relatório</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto mb-6">
              {availableMonths.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                    selectedMonths.has(m)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400'
                  }`}
                >
                  {selectedMonths.has(m) && <CheckIcon className="w-3 h-3 inline mr-1" />}
                  {new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedMonths(new Set(availableMonths))}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Selecionar Todos
              </button>
              <button
                onClick={generatePDF}
                disabled={generating || selectedMonths.size === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Gerando...</>
                ) : (
                  <><DocumentArrowDownIcon className="w-4 h-4" /> Baixar PDF ({selectedMonths.size} {selectedMonths.size === 1 ? 'mês' : 'meses'})</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
