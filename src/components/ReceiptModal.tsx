import React, { useState } from 'react';
import { PixReceipt } from '../types';
import { formatBRL, formatCPF, getSettings } from '../services/storage';
import {
  X,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Download,
  Printer,
} from 'lucide-react';
import { generateSingleReceiptPdf } from '../services/pdfService';

interface ReceiptModalProps {
  receipt: PixReceipt | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: 'CONFIRMADO' | 'REJEITADO' | 'PENDENTE', obs?: string) => void;
  isAdmin?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  onClose,
  onUpdateStatus,
  isAdmin = false,
}) => {
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  if (!receipt) return null;

  const isPdf = receipt.comprovantePix.type.includes('pdf') || receipt.comprovantePix.name.toLowerCase().endsWith('.pdf');

  const handleDownload = () => {
    if (receipt.comprovantePix.base64) {
      const link = document.createElement('a');
      link.href = receipt.comprovantePix.base64;
      link.download = receipt.comprovantePix.name || `comprovante_${receipt.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (receipt.comprovantePix.driveUrl) {
      window.open(receipt.comprovantePix.driveUrl, '_blank');
    }
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('Por favor, informe a justificativa da recusa.');
      return;
    }
    setRejectError(null);
    if (onUpdateStatus) {
      onUpdateStatus(receipt.id, 'REJEITADO', rejectReason.trim());
    }
    setIsRejecting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-mono text-xs font-bold px-2 py-1 bg-slate-200 text-slate-800 rounded-md">
              {receipt.id}
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                receipt.status === 'CONFIRMADO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : receipt.status === 'REJEITADO'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {receipt.status === 'CONFIRMADO' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {receipt.status === 'PENDENTE' && <Clock className="w-3.5 h-3.5" />}
              {receipt.status === 'REJEITADO' && <AlertCircle className="w-3.5 h-3.5" />}
              {receipt.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-100 text-sm">
            <div>
              <span className="text-xs text-slate-400 block font-medium">VALOR DO PAGAMENTO</span>
              <span className="text-xl font-bold text-emerald-700 tabular-nums">
                {formatBRL(receipt.valorPagamento)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">CPF DO CLIENTE</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCPF(receipt.cpf)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">DATA DO PAGAMENTO</span>
              <span className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {new Date(receipt.data).toLocaleString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">TITULAR / SERVIDOR</span>
              <span className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                <User className="w-4 h-4 text-slate-400" />
                {receipt.nomeServidor || 'Não informado'}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs text-slate-400 block font-medium">REFERÊNCIA / DESCRIÇÃO</span>
              <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                <FileText className="w-4 h-4 text-slate-400" />
                {receipt.referencia}
              </span>
            </div>
            {receipt.observacaoCliente && (
              <div className="sm:col-span-2 bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-emerald-950 text-xs">
                <strong className="block font-semibold mb-0.5 text-emerald-800">Observação do Cliente:</strong>
                {receipt.observacaoCliente}
              </div>
            )}
            {receipt.observacoes && receipt.observacoes !== receipt.observacaoCliente && (
              <div className="sm:col-span-2 bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-xs">
                <strong className="block font-semibold mb-0.5">Observação da Auditoria / Administração:</strong>
                {receipt.observacoes}
              </div>
            )}
          </div>

          {/* Comprovante Visualizer */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Documento do Comprovante Pix
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      console.warn('Erro ao chamar window.print():', e);
                    }
                    generateSingleReceiptPdf(receipt, getSettings());
                  }}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  title="Imprimir ou baixar comprovante oficial em PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-600" /> Imprimir / Baixar PDF
                </button>
                {receipt.comprovantePix.driveUrl && (
                  <a
                    href={receipt.comprovantePix.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1 underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir no Drive
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Anexo
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center p-2 min-h-[220px] sm:min-h-[300px]">
              {receipt.comprovantePix.base64 ? (
                isPdf ? (
                  <div className="text-center p-6 text-white space-y-3">
                    <FileText className="w-14 h-14 mx-auto text-emerald-400" />
                    <p className="font-medium text-sm">{receipt.comprovantePix.name}</p>
                    <p className="text-xs text-slate-400">Documento em formato PDF</p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Visualizar ou Baixar PDF
                    </button>
                  </div>
                ) : (
                  <img
                    src={receipt.comprovantePix.base64}
                    alt={`Comprovante Pix ${receipt.id}`}
                    className="max-h-[380px] sm:max-h-[460px] max-w-full object-contain rounded-lg"
                  />
                )
              ) : receipt.comprovantePix.driveUrl ? (
                <div className="text-center p-6 text-white space-y-3 max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center mx-auto">
                    <ExternalLink className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-100">
                      Arquivo Registrado no Google Drive
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Este comprovante foi sincronizado via planilha e está armazenado com segurança na nuvem do Google Drive.
                    </p>
                  </div>
                  <a
                    href={receipt.comprovantePix.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Visualizar Arquivo no Google Drive</span>
                  </a>
                </div>
              ) : (
                <div className="text-center p-6 text-slate-400 space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-slate-500" />
                  <p className="text-xs font-semibold text-slate-300">
                    Comprovante excluído ou não localizado
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    A imagem foi excluída da pasta do Google Drive ou o anexo não está disponível neste dispositivo.
                  </p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Arquivo: {receipt.comprovantePix.name} ({Math.round(receipt.comprovantePix.size / 1024)} KB)
            </p>
          </div>
        </div>

        {/* Footer actions for Admin */}
        {isAdmin && onUpdateStatus && (
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 shrink-0">
            {isRejecting ? (
              <form onSubmit={handleConfirmReject} className="space-y-2">
                <label className="block text-xs font-bold text-rose-800">
                  Motivo da Recusa (visível para o cliente):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex: Valor divergente, comprovante ilegível ou agendado..."
                    required
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-xs border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-rose-700"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-1.5 text-slate-600 text-xs font-semibold hover:bg-slate-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-medium text-slate-500">
                  Modificar status:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(receipt.id, 'PENDENTE')}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      receipt.status === 'PENDENTE'
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectReason(receipt.observacoes || 'Comprovante ilegível ou divergente.');
                      setIsRejecting(true);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      receipt.status === 'REJEITADO'
                        ? 'bg-rose-100 border-rose-300 text-rose-800'
                        : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(receipt.id, 'CONFIRMADO', 'Confirmado no extrato')}
                    className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      receipt.status === 'CONFIRMADO'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    ✓ Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
