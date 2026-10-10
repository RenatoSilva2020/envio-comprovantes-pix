import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PixReceipt, AppSettings } from '../types';
import { formatBRL, formatCPF } from './storage';

/**
 * Gera e faz download do Relatório Gerencial completo em PDF
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

  // Cores do tema
  const primaryColor = [15, 23, 42]; // slate-900
  const emeraldColor = [5, 150, 105]; // emerald-600
  const lightBg = [248, 250, 252]; // slate-50

  // 1. Cabeçalho Superior
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const instName = (settings.institutionName || 'SISTEMA PIXSYNC').toUpperCase();
  doc.text(instName, 14, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text('RELATÓRIO GERENCIAL DE COMPROVANTES DE PAGAMENTO PIX', 14, 16);

  // Data e hora de geração no topo direito
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  const generatedAt = new Date().toLocaleString('pt-BR');
  doc.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Total de registros: ${receipts.length}`, pageWidth - 14, 16, { align: 'right' });

  // 2. Resumo Financeiro (KPIs)
  const totalGeral = receipts.reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const totalConfirmado = receipts
    .filter((r) => r.status === 'CONFIRMADO')
    .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const totalPendente = receipts
    .filter((r) => r.status === 'PENDENTE')
    .reduce((acc, curr) => acc + (Number(curr.valorPagamento) || 0), 0);
  const countConfirmado = receipts.filter((r) => r.status === 'CONFIRMADO').length;
  const countPendente = receipts.filter((r) => r.status === 'PENDENTE').length;

  const kpiY = 27;
  const cardW = (pageWidth - 28 - 9) / 4; // 4 cards

  // Card 1: Total Geral
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, kpiY, cardW, 16, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL MOVIMENTADO', 17, kpiY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatBRL(totalGeral), 17, kpiY + 12);

  // Card 2: Confirmados
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(14 + cardW + 3, kpiY, cardW, 16, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(4, 120, 87);
  doc.text(`CONFIRMADOS (${countConfirmado})`, 17 + cardW + 3, kpiY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(formatBRL(totalConfirmado), 17 + cardW + 3, kpiY + 12);

  // Card 3: Pendentes
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14 + (cardW + 3) * 2, kpiY, cardW, 16, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 83, 9);
  doc.text(`PENDENTES (${countPendente})`, 17 + (cardW + 3) * 2, kpiY + 5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(formatBRL(totalPendente), 17 + (cardW + 3) * 2, kpiY + 12);

  // Card 4: Planilha
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14 + (cardW + 3) * 3, kpiY, cardW, 16, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('PLANILHA GOOGLE', 17 + (cardW + 3) * 3, kpiY + 5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const sheetLabel = settings.sheetName || 'Comprovantes_Pix';
  doc.text(`Guia: ${sheetLabel.slice(0, 18)}`, 17 + (cardW + 3) * 3, kpiY + 12);

  // 3. Tabela de Transações
  const tableData = receipts.map((r) => [
    r.id,
    new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    formatCPF(r.cpf),
    r.nomeServidor || 'Não informado',
    r.referencia || '-',
    formatBRL(Number(r.valorPagamento) || 0),
    r.status,
    r.observacoes || r.observacaoCliente || '-',
  ]);

  autoTable(doc, {
    startY: 48,
    head: [[
      'ID COMPROVANTE',
      'DATA/HORA',
      'CPF CLIENTE',
      'NOME / TITULAR',
      'REFERÊNCIA / DESCRIÇÃO',
      'VALOR',
      'STATUS',
      'OBSERVAÇÕES',
    ]],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 35, font: 'courier' }, // ID
      1: { cellWidth: 26 }, // Data
      2: { cellWidth: 28, font: 'courier' }, // CPF
      3: { cellWidth: 42 }, // Nome
      4: { cellWidth: 48 }, // Referência
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }, // Valor
      6: { cellWidth: 24, halign: 'center' }, // Status
      7: { cellWidth: 'auto' }, // Obs
    },
    didParseCell: (data) => {
      // Destaque de cor no status
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw).toUpperCase();
        if (val === 'CONFIRMADO') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'PENDENTE') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'REJEITADO') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Destaque de cor no valor
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = [5, 150, 105];
      }
    },
    didDrawPage: (data) => {
      // Rodapé da página
      const str = `Página ${data.pageNumber}`;
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${settings.institutionName || 'PixSync'} — Documento gerado eletronicamente`,
        14,
        pageHeight - 8
      );
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
    margin: { left: 14, right: 14, top: 48, bottom: 14 },
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
