import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PixReceipt, AppSettings } from '../types';
import { formatBRL, formatCPF } from './storage';

/**
 * Gera e faz download do Relatório Gerencial completo em PDF com design moderno e executivo
 */
export function generateReportPdf(
  receipts: PixReceipt[],
  settings: AppSettings,
  filterInfo?: { cpf?: string; startDate?: string; endDate?: string; status?: string }
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Paleta de Cores Moderna (Slate & Emerald Executive)
  const colors = {
    brandDark: [15, 23, 42] as [number, number, number],       // slate-900
    brandAccent: [16, 185, 129] as [number, number, number],   // emerald-500
    brandPrimary: [5, 150, 105] as [number, number, number],   // emerald-600
    emeraldBg: [236, 253, 245] as [number, number, number],    // emerald-50
    slateBg: [248, 250, 252] as [number, number, number],      // slate-50
    cardBorder: [226, 232, 240] as [number, number, number],   // slate-200
    textPrimary: [15, 23, 42] as [number, number, number],     // slate-900
    textSecondary: [71, 85, 105] as [number, number, number],  // slate-600
    textMuted: [148, 163, 184] as [number, number, number],    // slate-400
    warning: [217, 119, 6] as [number, number, number],        // amber-600
    warningBg: [254, 243, 199] as [number, number, number],    // amber-100
    danger: [225, 29, 72] as [number, number, number],         // rose-600
    dangerBg: [255, 228, 230] as [number, number, number],     // rose-100
  };

  // 1. Cabeçalho Superior Executivo
  // Barra de destaque em degradê/duo-tom
  doc.setFillColor(...colors.brandDark);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Linha de acento esmeralda abaixo do banner
  doc.setFillColor(...colors.brandAccent);
  doc.rect(0, 24, pageWidth, 1.2, 'F');

  // Nome da Instituição
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const instName = (settings.institutionName || 'ESCOLA ESTADUAL MÁRIO PORTO (EEMP)').toUpperCase();
  doc.text(instName, 14, 10);

  // Subtítulo do relatório
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text('PAINEL GERENCIAL DE PRESTAÇÃO DE CONTAS · COMPROVANTES PIX', 14, 16.5);

  // Metadados do documento (lado direito)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR');
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`EMISSÃO: ${dateFormatted} às ${timeFormatted}`, pageWidth - 14, 10, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${receipts.length} ${receipts.length === 1 ? 'REGISTRO LOCALIZADO' : 'REGISTROS LOCALIZADOS'}`, pageWidth - 14, 16.5, { align: 'right' });

  // 2. Resumo de Métricas (KPI Cards com visual clean e profissional)
  const totalGeral = receipts.reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const totalConfirmado = receipts
    .filter((r) => r.status === 'CONFIRMADO')
    .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const totalPendente = receipts
    .filter((r) => r.status === 'PENDENTE')
    .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const countConfirmado = receipts.filter((r) => r.status === 'CONFIRMADO').length;
  const countPendente = receipts.filter((r) => r.status === 'PENDENTE').length;

  const kpiY = 29;
  const cardW = (pageWidth - 28 - 9) / 4; // 4 cards distribuídos
  const cardH = 17;

  // Helper para desenhar cartões com borda suave
  const drawCard = (
    x: number,
    bgColor: [number, number, number],
    borderColor: [number, number, number],
    label: string,
    labelColor: [number, number, number],
    value: string,
    valColor: [number, number, number],
    subText?: string
  ) => {
    doc.setFillColor(...bgColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, kpiY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...labelColor);
    doc.text(label.toUpperCase(), x + 3.5, kpiY + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...valColor);
    doc.text(value, x + 3.5, kpiY + 11.2);

    if (subText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.textMuted);
      doc.text(subText, x + 3.5, kpiY + 15);
    }
  };

  // Card 1: Total Geral
  drawCard(
    14,
    colors.slateBg,
    colors.cardBorder,
    'Volume Total',
    colors.textSecondary,
    formatBRL(totalGeral),
    colors.textPrimary,
    `${receipts.length} transações no relatório`
  );

  // Card 2: Confirmados
  drawCard(
    14 + (cardW + 3),
    colors.emeraldBg,
    [167, 243, 208],
    `Confirmados (${countConfirmado})`,
    colors.brandPrimary,
    formatBRL(totalConfirmado),
    colors.brandPrimary,
    countConfirmado > 0 ? `${((countConfirmado / (receipts.length || 1)) * 100).toFixed(0)}% do volume total` : 'Nenhum confirmado'
  );

  // Card 3: Pendentes
  drawCard(
    14 + (cardW + 3) * 2,
    colors.warningBg,
    [253, 230, 138],
    `Pendentes (${countPendente})`,
    colors.warning,
    formatBRL(totalPendente),
    colors.warning,
    countPendente > 0 ? 'Aguardando validação' : 'Todos processados'
  );

  // Card 4: Filtro e Planilha
  const filterDesc = filterInfo?.status && filterInfo.status !== 'TODOS'
    ? `Status: ${filterInfo.status}`
    : filterInfo?.cpf
    ? `CPF: ${formatCPF(filterInfo.cpf)}`
    : 'Visão Geral Completa';
  drawCard(
    14 + (cardW + 3) * 3,
    colors.slateBg,
    colors.cardBorder,
    'Filtro Ativo / Guia',
    colors.textSecondary,
    filterDesc,
    colors.textPrimary,
    `Google Sheets: ${settings.sheetName || 'Comprovantes_Pix'}`
  );

  // 3. Tabela de Transações Agrupadas por CPF com Subtotal
  const groupedByCpf = new Map<string, { formattedCpf: string; nome: string; items: PixReceipt[] }>();

  receipts.forEach((r) => {
    const key = (r.cpf || '').replace(/\D/g, '') || 'SEM_CPF';
    if (!groupedByCpf.has(key)) {
      groupedByCpf.set(key, {
        formattedCpf: formatCPF(r.cpf),
        nome: r.nomeServidor || 'Não informado',
        items: [],
      });
    }
    const group = groupedByCpf.get(key)!;
    if ((!group.nome || group.nome === 'Não informado') && r.nomeServidor) {
      group.nome = r.nomeServidor;
    }
    group.items.push(r);
  });

  // Constrói as linhas com cabeçalho de grupo moderno e linha de subtotal por CPF
  const tableBody: any[] = [];
  const groupHeaderRowIndexes = new Set<number>();
  const subtotalRowIndexes = new Set<number>();

  Array.from(groupedByCpf.values()).forEach((grp) => {
    const subtotal = grp.items.reduce((sum, item) => sum + (Number(item.valorPagamento) || 0), 0);
    const subtotalConfirmado = grp.items
      .filter((i) => i.status === 'CONFIRMADO')
      .reduce((sum, item) => sum + (Number(item.valorPagamento) || 0), 0);

    // Linha de Cabeçalho do Grupo (Visual executivo com CPF destacado)
    const headerRowIdx = tableBody.length;
    groupHeaderRowIndexes.add(headerRowIdx);
    tableBody.push([
      {
        content: `TITULAR: ${grp.nome.toUpperCase()}   |   CPF: ${grp.formattedCpf}   (${grp.items.length} ${grp.items.length === 1 ? 'lançamento' : 'lançamentos'})`,
        colSpan: 7,
      },
    ]);

    // Linhas de Comprovantes do CPF (7 colunas exatamente iguais à tabela do modal)
    grp.items.forEach((r) => {
      tableBody.push([
        r.id,
        new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        formatCPF(r.cpf),
        r.nomeServidor || 'Não informado',
        r.referencia || '-',
        formatBRL(Number(r.valorPagamento) || 0),
        r.status,
      ]);
    });

    // Linha de Subtotal por CPF
    const subtotalRowIdx = tableBody.length;
    subtotalRowIndexes.add(subtotalRowIdx);
    const subtotalLabel = `Subtotal ${grp.formattedCpf} (${grp.items.length} ${grp.items.length === 1 ? 'item' : 'itens'}${subtotalConfirmado > 0 ? ` · Conf: ${formatBRL(subtotalConfirmado)}` : ''}):`;
    tableBody.push([
      {
        content: subtotalLabel,
        colSpan: 5,
      },
      formatBRL(subtotal),
      '',
    ]);
  });

  autoTable(doc, {
    startY: 50,
    head: [[
      'ID COMPROVANTE',
      'DATA / HORA',
      'CPF DO CLIENTE',
      'NOME / TITULAR',
      'REFERÊNCIA / DESCRIÇÃO',
      'VALOR (R$)',
      'SITUAÇÃO',
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240], // Linhas de grade suaves e limpas (slate-200)
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      lineColor: [15, 23, 42],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 38, font: 'helvetica', fontStyle: 'bold', textColor: [51, 65, 85] }, // ID Comprovante
      1: { cellWidth: 32, textColor: [71, 85, 105] }, // Data / Hora
      2: { cellWidth: 34, textColor: [51, 65, 85] }, // CPF do Cliente
      3: { cellWidth: 50, fontStyle: 'bold' }, // Nome / Titular
      4: { cellWidth: 'auto' }, // Referência / Descrição
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }, // Valor (R$)
      6: { cellWidth: 34, halign: 'center' }, // Situação
    },
    didParseCell: (data) => {
      // 1. Cabeçalho de Grupo por CPF (faixa de destaque elegante com borda limpa)
      if (data.section === 'body' && groupHeaderRowIndexes.has(data.row.index)) {
        data.cell.styles.fillColor = [241, 245, 249]; // slate-100
        data.cell.styles.textColor = [15, 23, 42];    // slate-900
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.2;
        data.cell.styles.cellPadding = { top: 2.8, bottom: 2.8, left: 3, right: 3 };
        data.cell.styles.lineColor = [203, 213, 225]; // slate-300
        data.cell.styles.lineWidth = 0.2;
        return;
      }

      // 2. Subtotal por CPF
      if (data.section === 'body' && subtotalRowIndexes.has(data.row.index)) {
        data.cell.styles.fillColor = [248, 250, 252]; // slate-50
        data.cell.styles.textColor = [15, 23, 42];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.cellPadding = { top: 2.5, bottom: 2.5, left: 3, right: 3 };
        data.cell.styles.lineColor = [226, 232, 240];
        data.cell.styles.lineWidth = 0.15;
        if (data.column.index === 0) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontSize = 7.8;
          data.cell.styles.textColor = [51, 65, 85];
        }
        if (data.column.index === 1 || data.column.index === 5) {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.halign = 'right';
          data.cell.styles.fontSize = 8.8;
        }
        return;
      }

      // Linhas de dados normais com fundo branco puro e linhas de grade clean
      if (data.section === 'body') {
        data.cell.styles.fillColor = [255, 255, 255]; // Fundo branco uniforme
        data.cell.styles.lineColor = [226, 232, 240]; // slate-200
        data.cell.styles.lineWidth = 0.15;
      }

      // 3. Status - Oculta texto bruto da célula para desenharmos a Badge Pill arredondada idêntica ao print 1
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = [255, 255, 255];
      }

      // 4. Valor financeiro
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = [5, 150, 105];
      }
    },
    didDrawCell: (data) => {
      // Desenha a Badge Pill arredondada com borda suave para a coluna de Situação (exatamente como no print 1)
      if (
        data.section === 'body' &&
        data.column.index === 6 &&
        !groupHeaderRowIndexes.has(data.row.index) &&
        !subtotalRowIndexes.has(data.row.index)
      ) {
        const val = String(data.cell.raw || '').trim().toUpperCase();
        if (val) {
          const badgeW = 28;
          const badgeH = 5.2;
          const badgeX = data.cell.x + (data.cell.width - badgeW) / 2;
          const badgeY = data.cell.y + (data.cell.height - badgeH) / 2;

          let bg: [number, number, number] = [236, 253, 245];   // emerald-50
          let border: [number, number, number] = [167, 243, 208]; // emerald-200
          let textCol: [number, number, number] = [4, 120, 87];   // emerald-700

          if (val === 'PENDENTE') {
            bg = [254, 243, 199];   // amber-50
            border = [253, 230, 138]; // amber-200
            textCol = [180, 83, 9];   // amber-700
          } else if (val === 'REJEITADO') {
            bg = [255, 228, 230];   // rose-50
            border = [254, 205, 211]; // rose-200
            textCol = [190, 18, 60];  // rose-700
          }

          doc.setFillColor(...bg);
          doc.setDrawColor(...border);
          doc.setLineWidth(0.25);
          doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.6, 2.6, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(...textCol);
          doc.text(val, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.1, { align: 'center' });
        }
      }
    },
    didDrawPage: (data) => {
      // Rodapé da página moderno
      const pageY = pageHeight - 9;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(14, pageY - 3, pageWidth - 14, pageY - 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${settings.institutionName || 'PixSync'} · Relatório Financeiro e Auditoria Pix · Documento Gerado Eletronicamente`,
        14,
        pageY + 1
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`Página ${data.pageNumber}`, pageWidth - 14, pageY + 1, { align: 'right' });
    },
    margin: { left: 14, right: 14, top: 50, bottom: 15 },
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio_pixsync_${dateSlug}.pdf`);
}

/**
 * Gera e faz download do Comprovante Individual em PDF (Certificado/Recibo Pix)
 */
export function generateSingleReceiptPdf(receipt: PixReceipt, settings: AppSettings): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const instName = (settings.institutionName || 'SISTEMA PIXSYNC').toUpperCase();
  doc.text(instName, 15, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text('RECIBO / COMPROVANTE OFICIAL DE PAGAMENTO PIX', 15, 20);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`ID: ${receipt.id}`, pageWidth - 15, 13, { align: 'right' });
  doc.text(
    `Emitido em: ${new Date().toLocaleString('pt-BR')}`,
    pageWidth - 15,
    20,
    { align: 'right' }
  );

  // Status Badge box
  const statusColor: Record<string, [number, number, number]> = {
    CONFIRMADO: [5, 150, 105],
    PENDENTE: [217, 119, 6],
    REJEITADO: [225, 29, 72],
  };
  const currentStatus = (receipt.status || 'PENDENTE').toUpperCase();
  const sColor = statusColor[currentStatus] || [100, 116, 139];

  // Valor box principal
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 40, pageWidth - 30, 36, 3, 3, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('VALOR DO PAGAMENTO:', 22, 50);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(formatBRL(Number(receipt.valorPagamento) || 0), 22, 63);

  // Status badge inside box
  doc.setFillColor(sColor[0], sColor[1], sColor[2]);
  doc.roundedRect(pageWidth - 65, 48, 42, 10, 2, 2, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`STATUS: ${currentStatus}`, pageWidth - 44, 54.5, { align: 'center' });

  // Detalhes da Operação
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DETALHES DA TRANSAÇÃO', 15, 86);

  const fields = [
    { label: 'Identificador (ID):', value: receipt.id },
    { label: 'CPF do Cliente:', value: formatCPF(receipt.cpf) },
    { label: 'Titular / Servidor:', value: receipt.nomeServidor || 'Não informado' },
    { label: 'Referência / Descrição:', value: receipt.referencia || '-' },
    {
      label: 'Data e Hora do Pagamento:',
      value: new Date(receipt.data).toLocaleString('pt-BR'),
    },
    {
      label: 'Data de Registro no Sistema:',
      value: new Date(receipt.criadoEm).toLocaleString('pt-BR'),
    },
    {
      label: 'Sincronizado na Planilha:',
      value: receipt.sincronizadoSheets ? 'Sim (Google Sheets)' : 'Pendente de sincronização',
    },
  ];

  let currentY = 93;
  fields.forEach((f, idx) => {
    // Fundo zebra
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY - 4.5, pageWidth - 30, 9, 'F');
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(f.label, 18, currentY + 1.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(f.value, 72, currentY + 1.5);

    currentY += 9;
  });

  // Observações se existirem
  if (receipt.observacaoCliente || receipt.observacoes) {
    currentY += 4;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVAÇÕES', 15, currentY);

    currentY += 4;
    doc.setFillColor(254, 252, 232); // light yellow
    doc.setDrawColor(254, 240, 138);
    doc.roundedRect(15, currentY, pageWidth - 30, 18, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(113, 63, 18);
    const obsText = receipt.observacoes || receipt.observacaoCliente || '';
    const splitObs = doc.splitTextToSize(obsText, pageWidth - 40);
    doc.text(splitObs, 19, currentY + 6);

    currentY += 24;
  } else {
    currentY += 8;
  }

  // Comprovante Anexo info
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DOCUMENTO DO COMPROVANTE', 15, currentY);

  currentY += 4;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, currentY, pageWidth - 30, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Arquivo anexado: ${receipt.comprovantePix.name}`, 19, currentY + 6);
  if (receipt.comprovantePix.driveUrl) {
    doc.setTextColor(5, 150, 105);
    doc.text(`Link no Google Drive: ${receipt.comprovantePix.driveUrl.slice(0, 60)}...`, 19, currentY + 11);
  } else {
    doc.text('Arquivo armazenado localmente no dispositivo.', 19, currentY + 11);
  }

  // Rodapé de Autenticidade
  doc.setDrawColor(203, 213, 225);
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Este documento comprova o envio e registro de pagamento Pix no sistema PixSync.',
    15,
    pageHeight - 19
  );
  doc.text(
    `Código de Autenticação: SHA256-${receipt.id.replace(/[^A-Z0-9]/g, '')}-${receipt.cpf.slice(0, 6)}`,
    15,
    pageHeight - 14
  );
  doc.text(
    `Página 1 de 1`,
    pageWidth - 15,
    pageHeight - 14,
    { align: 'right' }
  );

  doc.save(`comprovante_${receipt.id}.pdf`);
}

/**
 * Função segura para acionar a impressão do navegador com fallback
 */
export function triggerPrintWindow(): void {
  try {
    window.print();
  } catch (e) {
    console.warn('Erro ao chamar window.print():', e);
  }
}
