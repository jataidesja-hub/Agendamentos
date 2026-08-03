export async function gerarRelatorioGerencialPdf(data: { month: string, grouped: any, topKm: any[], topValor: any[] }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;
  let y = 14;

  const checkPage = (needed = 10) => {
    if (y + needed > 280) { pdf.addPage(); y = 14; }
  };

  // Header
  pdf.setFillColor(11, 115, 54);
  pdf.rect(0, 0, W, 22, "F");
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("RELATÓRIO GERENCIAL DE FROTA", W / 2, 10, { align: "center" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  const monthName = new Date(data.month + "-02").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  pdf.text(`MÊS REFERÊNCIA: ${monthName}`, W / 2, 17, { align: "center" });
  y = 35;

  // Tops (lado a lado)
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOP 5 VEÍCULOS (MAIOR KM)", ML, y);
  pdf.text("TOP 5 VEÍCULOS (MAIOR CUSTO)", W / 2 + 5, y);
  y += 6;
  
  pdf.setFontSize(8);
  for (let i = 0; i < 5; i++) {
    pdf.setFont("helvetica", "normal");
    
    // Top KM
    if (data.topKm[i]) {
      const [placa, stats] = data.topKm[i];
      pdf.text(`${i + 1}. ${placa} - ${stats.proj} - ${stats.km.toLocaleString('pt-BR')} km`, ML, y);
    }
    
    // Top Valor
    if (data.topValor[i]) {
      const [placa, stats] = data.topValor[i];
      const valor = stats.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      pdf.text(`${i + 1}. ${placa} - ${stats.proj} - ${valor}`, W / 2 + 5, y);
    }
    
    y += 5;
  }

  y += 10;
  checkPage();

  // Detalhamento por Projetos
  for (const proj in data.grouped) {
    checkPage(20);
    const projData = data.grouped[proj];
    
    pdf.setFillColor(240, 240, 240);
    pdf.rect(ML, y - 4, CW, 8, "F");
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`PROJETO: ${proj}`, ML + 2, y + 1);
    
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    const resumo = `${projData.vehicles.length} veículos | ${projData.totalKm.toLocaleString('pt-BR')} km | ${projData.totalLiters.toLocaleString('pt-BR')} L | ${projData.totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    pdf.text(resumo, W - MR - 2, y + 1, { align: "right" });
    
    y += 8;
    checkPage(5);

    // Header da tabela de veículos
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("PLACA", ML + 2, y);
    pdf.text("KM RODADO", ML + 40, y);
    pdf.text("LITROS", ML + 80, y);
    pdf.text("CUSTO (R$)", ML + 120, y);
    y += 4;
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(ML, y - 2, W - MR, y - 2);

    // Veiculos
    for (const v of projData.vehicles) {
      checkPage(5);
      pdf.setFont("helvetica", "normal");
      
      pdf.text(v.placa, ML + 2, y);
      pdf.text(v.km.toLocaleString('pt-BR'), ML + 40, y);
      pdf.text(v.liters.toLocaleString('pt-BR'), ML + 80, y);
      pdf.text(v.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), ML + 120, y);
      
      y += 5;
    }
    y += 5;
  }

  pdf.save(`Relatorio_Gerencial_${data.month}.pdf`);
}
