// Geração de PDF do Informe de Controle de Veículos sem html2canvas

const FOTO_SPOTS = [
  { id: "farol_esq", label: "Farol Esquerdo" },
  { id: "farol_dir", label: "Farol Direito" },
  { id: "frente", label: "Frente" },
  { id: "lanterna_esq", label: "Lanterna Esquerda" },
  { id: "lanterna_dir", label: "Lanterna Direita" },
  { id: "tras", label: "Traseira" },
  { id: "lado_esq", label: "Lado Esquerdo" },
  { id: "lado_dir", label: "Lado Direito" },
  { id: "teto", label: "Teto" },
  { id: "interna_esq", label: "Interna Esquerda" },
  { id: "interna_meio", label: "Interna Meio" },
  { id: "interna_dir", label: "Interna Direita" },
  { id: "estepe", label: "Estepe" },
  { id: "mala", label: "Mala / Carroceria / Baú" },
  { id: "chave_roda", label: "Chave de Roda" },
  { id: "documento", label: "Documento do Veículo" },
  { id: "painel_km", label: "Painel com KM" },
  { id: "som", label: "Som" },
];

// Converte URL de imagem para base64 via canvas (funciona com CORS)
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const GRUPOS = [
  { nome: "Iluminação", itens: [{ id: 1, label: "Lanternas dianteiras / traseiras" }, { id: 2, label: "Seta direita / Esquerda" }, { id: 3, label: "Estado Lente farol Dianteiro" }, { id: 4, label: "Luz baixa" }, { id: 5, label: "Luz Alta" }, { id: 6, label: "Luz de Freio" }, { id: 7, label: "Lanterna Traseira" }, { id: 8, label: "Luz de Ré" }, { id: 9, label: "Luz Interna" }, { id: 10, label: "Luz do Painel" }, { id: 11, label: "Alarme de Ré" }] },
  { nome: "Vidros e Visibilidade", itens: [{ id: 12, label: "Aspersos / Limpador pára-brisa" }, { id: 13, label: "Palheta limpador do pára brisa" }, { id: 14, label: "Pára-brisa" }, { id: 15, label: "Velocímetro" }, { id: 16, label: "Desembaçador interno" }, { id: 17, label: "Aquecedor" }] },
  { nome: "Interior", itens: [{ id: 18, label: "Portas" }, { id: 19, label: "Chaves Original e Reserva" }, { id: 20, label: "Assentos" }, { id: 21, label: "Manivelas e alavanca dos vidros" }, { id: 22, label: "Espelho retrovisor" }, { id: 23, label: "Cintos de segurança" }, { id: 24, label: "Aberturas / Teto solar" }, { id: 25, label: "Tapa-sol" }] },
  { nome: "Exterior", itens: [{ id: 26, label: "Estribos laterais" }, { id: 27, label: "Santo Antonio" }, { id: 28, label: "Proteção da frente" }, { id: 52, label: "Arranhões / riscos / pintura / amassados" }] },
  { nome: "Freios e Pneus", itens: [{ id: 29, label: "Freio de Mão" }, { id: 30, label: "Verificar estado dos Freios" }, { id: 31, label: "Estado dos Pneus" }, { id: 33, label: "Tipo / Medidas dos Pneus" }, { id: 34, label: "Verificar estado do Pneu de Estepe" }] },
  { nome: "Motor e Fluidos", itens: [{ id: 35, label: "Mangueiras do Motor" }, { id: 36, label: "Bateria / Capacidade" }, { id: 45, label: "Troca de Óleo Km." }, { id: 46, label: "Nível de óleo" }, { id: 47, label: "Funcionamento Ventoinha" }, { id: 48, label: "Vazamento óleo / água" }, { id: 49, label: "Barulhos estranhos" }] },
  { nome: "Segurança e Emergência", itens: [{ id: 37, label: "Tanque Combustível" }, { id: 38, label: "Chaves de Rodas" }, { id: 39, label: "Macaco" }, { id: 40, label: "Triangulo" }, { id: 41, label: "Extintor" }] },
  { nome: "Documentação", itens: [{ id: 42, label: "Documento de Veiculo" }, { id: 43, label: "Cartão Seguro" }, { id: 44, label: "Cartão Abastecimento" }] },
  { nome: "Carroceria e Acessórios", itens: [{ id: 32, label: "Mala" }, { id: 50, label: "Capota" }, { id: 51, label: "Vigia" }, { id: 53, label: "Radio Amador Frequencia CERON" }, { id: 54, label: "Aparelho de Som" }, { id: 55, label: "Veiculo é Individual" }, { id: 56, label: "Diferencial" }, { id: 57, label: "Dupla Tração" }, { id: 58, label: "Tapetes" }, { id: 59, label: "Cadeados Caixas Carroceria e Vara LV" }, { id: 60, label: "Escadas" }, { id: 61, label: "Grade de Carroceria para Escada" }, { id: 62, label: "Caixas de Ferramentas" }] },
  { nome: "Verificações Gerais", itens: [{ id: 63, label: "Verificar Condições dos Para-choques" }, { id: 64, label: "Verificar Fixação dos Paralamas" }, { id: 65, label: "Verificar Existência e Fechamento da Tampa de Combustível" }, { id: 66, label: "Verificar Existência de Placa de Ident. Dianteira e Traseira" }, { id: 67, label: "Verificar Existência de Iluminação e Lacre na Placa traseira" }, { id: 68, label: "Verificar se o Condutor Possue Habilitação Compatível e dentro da validade" }, { id: 69, label: "Verificar se o Condutor Possue de direção defensiva dentro da validade" }, { id: 70, label: "Verificar funcionamento do Ar Condicionado" }, { id: 71, label: "Verificar estado e funcionamento da Buzina" }] },
];

const STATUS_COLORS: Record<string, [number, number, number]> = {
  OK: [22, 163, 74],
  C: [234, 88, 12],
  F: [239, 68, 68],
  V: [37, 99, 235],
  L: [147, 51, 234],
  SD: [156, 163, 175],
};

export async function gerarChecklistPdf(data: any) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;
  let y = 14;

  const checkPage = (needed = 8) => {
    if (y + needed > 280) { pdf.addPage(); y = 14; }
  };

  // ── Cabeçalho ──
  pdf.setFillColor(11, 115, 54);
  pdf.rect(0, 0, W, 22, "F");
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("INFORME DE CONTROLE DE VEÍCULOS", W / 2, 10, { align: "center" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text("CYMI — Gerenciamentos", W / 2, 17, { align: "center" });
  y = 28;

  // ── Dados do veículo ──
  pdf.setFillColor(245, 245, 245);
  pdf.rect(ML, y, CW, 40, "F");
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(ML, y, CW, 40, "S");

  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(100, 100, 100);

  const campos: [string, string, number, number][] = [
    ["PLACA", data.placa || "—", ML + 4, y + 6],
    ["CONDUTOR", data.condutor || "—", ML + 4 + CW / 2, y + 6],
    ["KM INSPEÇÃO", data.km_inspecao || data.km || "—", ML + 4, y + 16],
    ["DATA INSPEÇÃO", data.data_inspecao ? new Date(data.data_inspecao + "T12:00:00").toLocaleDateString("pt-BR") : "—", ML + 4 + CW / 2, y + 16],
    ["PROJETO", data.projeto || "—", ML + 4, y + 26],
    ["LOCAL", data.local_inspecao || "—", ML + 4 + CW / 2, y + 26],
    ["MODELO/TIPO", data.modelo || data.tipo_marca || "—", ML + 4, y + 36],
    ["FUNÇÃO", data.funcao || "—", ML + 4 + CW / 2, y + 36],
  ];

  campos.forEach(([label, val, x, cy]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(120, 120, 120);
    pdf.setFontSize(6);
    pdf.text(label, x, cy - 2);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(8);
    pdf.text(String(val).substring(0, 38), x, cy + 3);
  });

  y += 46;

  // ── Grupos do checklist ──
  const respostas = data.respostas || {};

  for (const grupo of GRUPOS) {
    checkPage(12);
    pdf.setFillColor(11, 115, 54);
    pdf.rect(ML, y, CW, 6, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(grupo.nome.toUpperCase(), ML + 3, y + 4.2);
    y += 7;

    for (const item of grupo.itens) {
      checkPage(6);
      const resp = respostas[item.id];
      const situacao: string = resp?.situacao || "";

      // Linha alternada
      if (grupo.itens.indexOf(item) % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(ML, y, CW, 6, "F");
      }

      pdf.setDrawColor(235, 235, 235);
      pdf.line(ML, y + 6, ML + CW, y + 6);

      pdf.setFontSize(6);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      pdf.text(`${item.id}.`, ML + 2, y + 4);
      pdf.text(item.label.substring(0, 70), ML + 8, y + 4);

      if (situacao) {
        const [r, g, b] = STATUS_COLORS[situacao] || [156, 163, 175];
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(ML + CW - 16, y + 0.8, 14, 4.5, 1, 1, "F");
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text(situacao, ML + CW - 9, y + 4, { align: "center" });
      }

      if (resp?.obs) {
        y += 6;
        checkPage(5);
        pdf.setFontSize(5.5);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(130, 130, 130);
        pdf.text(`  Obs: ${resp.obs.substring(0, 90)}`, ML + 8, y + 3.5);
      }

      y += 6;
    }
    y += 2;
  }

  // ── Fotos ──
  const fotos = data.fotos || {};
  const spotsComFoto = FOTO_SPOTS.filter(s => fotos[s.id]);

  if (spotsComFoto.length > 0) {
    checkPage(12);
    pdf.setFillColor(11, 115, 54);
    pdf.rect(ML, y, CW, 6, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("FOTOS DO VEÍCULO", ML + 3, y + 4.2);
    y += 8;

    const COLS = 3;
    const CELL_W = CW / COLS;
    const CELL_H = 42; // label + imagem
    const IMG_W = CELL_W - 4;
    const IMG_H = 32;

    let col = 0;
    let rowY = y;

    for (const spot of spotsComFoto) {
      const foto = fotos[spot.id];
      const x = ML + col * CELL_W;

      // Label
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(80, 80, 80);
      pdf.text(spot.label.substring(0, 22), x + 2, rowY + 4);

      if (foto.sem_foto) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(x + 2, rowY + 5, IMG_W, IMG_H, "F");
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(160, 160, 160);
        pdf.text("NÃO CONTEM", x + 2 + IMG_W / 2, rowY + 5 + IMG_H / 2, { align: "center" });
      } else if (foto.url) {
        const b64 = await urlToBase64(foto.url);
        if (b64) {
          try {
            pdf.addImage(b64, "JPEG", x + 2, rowY + 5, IMG_W, IMG_H, undefined, "FAST");
            pdf.setDrawColor(220, 220, 220);
            pdf.rect(x + 2, rowY + 5, IMG_W, IMG_H, "S");
          } catch {
            pdf.setFillColor(240, 240, 240);
            pdf.rect(x + 2, rowY + 5, IMG_W, IMG_H, "F");
          }
        }
      }

      col++;
      if (col >= COLS) {
        col = 0;
        rowY += CELL_H;
        y = rowY;
        checkPage(CELL_H);
        rowY = y;
      }
    }

    // Avança y para o final da última linha incompleta
    if (col > 0) y = rowY + CELL_H;
    y += 4;
  }

  // ── Observações gerais ──
  if (data.observacao_geral) {
    checkPage(20);
    pdf.setFillColor(255, 251, 235);
    pdf.setDrawColor(217, 119, 6);
    pdf.rect(ML, y, CW, 8, "FD");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(120, 60, 0);
    pdf.text("OBSERVAÇÕES GERAIS", ML + 3, y + 5);
    y += 10;

    const linhas = pdf.splitTextToSize(data.observacao_geral, CW - 6);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);
    linhas.forEach((linha: string) => {
      checkPage(5);
      pdf.text(linha, ML + 3, y + 4);
      y += 5;
    });
  }

  // ── Rodapé ──
  const totalPags = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    pdf.setPage(i);
    pdf.setFontSize(6);
    pdf.setTextColor(180, 180, 180);
    pdf.text(`Página ${i} de ${totalPags}`, W - MR, 290, { align: "right" });
    pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, ML, 290);
  }

  const placa = (data.placa || "checklist").replace(/[^a-zA-Z0-9]/g, "");
  const dataStr = data.data_inspecao || new Date().toISOString().split("T")[0];
  pdf.save(`checklist_${placa}_${dataStr}.pdf`);
}
