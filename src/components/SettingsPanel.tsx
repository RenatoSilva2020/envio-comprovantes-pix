import React, { useState } from 'react';
import { AppSettings } from '../types';
import {
  generateGasCode,
  generateStandaloneIndexHtml,
  generateClaspConfig,
  generateGithubWorkflow,
} from '../services/gasCodeGenerator';
import { testGasConnection } from '../services/gasService';
import { formatBRL, parseBRL, saveCurrentStateAsDefault, resetToDefaultSettings } from '../services/storage';
import {
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  Code2,
  FileCode,
  Github,
  Zap,
  HelpCircle,
  AlertTriangle,
  FolderSync,
  TableProperties,
  Download,
  FolderKey,
  Database,
  Check,
  Tag,
  Plus,
  Trash2,
  BookmarkCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [activeCodeTab, setActiveCodeTab] = useState<'gs' | 'html' | 'github'>('gs');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    running: boolean;
    success?: boolean;
    message?: string;
  }>({ running: false });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState<boolean>(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);

  // Estado para cadastro de nova Referência com Valor Fixo
  const [newRefLabel, setNewRefLabel] = useState<string>('');
  const [newRefValor, setNewRefValor] = useState<string>('');
  const [refError, setRefError] = useState<string | null>(null);

  const gasCode = generateGasCode(formData);
  const indexHtml = generateStandaloneIndexHtml(formData);
  const claspJson = generateClaspConfig(formData);
  const githubWorkflow = generateGithubWorkflow();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleSetCurrentAsDefault = () => {
    saveCurrentStateAsDefault(formData);
    onSaveSettings(formData);
    setDefaultSavedSuccess(true);
    setTimeout(() => setDefaultSavedSuccess(false), 4000);
  };

  const handleResetToDefault = () => {
    const restored = resetToDefaultSettings();
    setFormData(restored);
    onSaveSettings(restored);
    setResetConfirmOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleAddReference = (e: React.FormEvent) => {
    e.preventDefault();
    setRefError(null);
    const val = parseBRL(newRefValor);
    if (!newRefLabel.trim() || isNaN(val) || val <= 0) {
      setRefError('Por favor, informe uma descrição e um valor fixo maior que zero.');
      return;
    }

    const newItem = {
      id: `ref-${Date.now()}`,
      label: newRefLabel.trim(),
      valor: val,
    };

    const currentList = formData.referenciasPredefinidas || [];
    const updated = [...currentList, newItem];
    const newSettings = { ...formData, referenciasPredefinidas: updated };
    setFormData(newSettings);
    onSaveSettings(newSettings);
    setNewRefLabel('');
    setNewRefValor('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRemoveReference = (id: string) => {
    const currentList = formData.referenciasPredefinidas || [];
    const updated = currentList.filter((r) => r.id !== id);
    const newSettings = { ...formData, referenciasPredefinidas: updated };
    setFormData(newSettings);
    onSaveSettings(newSettings);
  };

  const handleTestConnection = async () => {
    setTestResult({ running: true });
    const res = await testGasConnection(formData);
    setTestResult({
      running: false,
      success: res.ok,
      message: res.message,
    });
  };

  const handleCopySheetHeaders = () => {
    const headersTab = "ID\tDATA_PAGAMENTO\tCPF\tNOME_SERVIDOR\tREFERENCIA\tVALOR_PAGAMENTO\tSTATUS\tLINK_COMPROVANTE\tDATA_REGISTRO\tOBSERVACOES";
    navigator.clipboard.writeText(headersTab);
    setCopyFeedback('headers');
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  const handleDownloadSheetTemplateCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        'ID;DATA_PAGAMENTO;CPF;NOME_SERVIDOR;REFERENCIA;VALOR_PAGAMENTO;STATUS;LINK_COMPROVANTE;DATA_REGISTRO;OBSERVACOES',
        'PIX-202610-8F1A02;2026-10-08 14:30;123.456.789-00;Carlos Eduardo Oliveira;Matricula 2026/2 - Taxa de Inscricao;350.00;CONFIRMADO;https://drive.google.com/file/d/sample/view;2026-10-08 14:35;Identificado no extrato bancario',
        'PIX-202610-C43D11;2026-10-08 09:15;987.654.321-99;Mariana Lima Rocha;Mensalidade Outubro/2026;890.50;PENDENTE;;2026-10-08 09:20;Aguardando conferencia',
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `modelo_planilha_pixsync_${formData.sheetName || 'Comprovantes_Pix'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Banner / Title */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-700/60 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full mb-2">
              <Zap className="w-3.5 h-3.5" />
              <span>Integração Google Workspace &amp; GitHub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Painel de Personalização do Google Apps Script &amp; Sheets
            </h2>
            <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
              Configure o ID da planilha, o ID da pasta do Google Drive onde os comprovantes serão salvos, a URL do Web App do GAS e copie o código completo do
              <code className="bg-emerald-900/60 px-1.5 py-0.5 rounded text-xs ml-1 font-mono">codigo.gs</code> e
              <code className="bg-emerald-900/60 px-1.5 py-0.5 rounded text-xs ml-1 font-mono">index.html</code> para deploy e versionamento facilitado no GitHub.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="#estrutura-planilha"
              className="px-4 py-2 bg-white text-emerald-900 text-xs font-bold rounded-xl hover:bg-emerald-50 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              <Database className="w-4 h-4 text-emerald-700" />
              <span>Ver Estrutura da Planilha</span>
            </a>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-emerald-900 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Configurações salvas com sucesso! O código do Google Apps Script abaixo foi atualizado com o ID da pasta e da planilha.</span>
          </div>
          <button
            onClick={() => setSaveSuccess(false)}
            className="text-emerald-700 text-xs font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {defaultSavedSuccess && (
        <div className="bg-teal-50 border border-teal-300 rounded-xl p-4 text-teal-950 text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-teal-600 shrink-0" />
            <span>
              <strong>Estado Atual Definido Como Padrão!</strong> Todas as configurações, referências predefinidas e IDs foram salvos como o estado padrão permanente do sistema.
            </span>
          </div>
          <button
            onClick={() => setDefaultSavedSuccess(false)}
            className="text-teal-800 text-xs font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Grid: Formulário de Configurações + Teste */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Parâmetros da Planilha, Pasta do Drive e do Web App (GAS)
              </h3>
              <p className="text-xs text-slate-500">
                Altere aqui os identificadores para vincular à sua própria conta Google
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* ID da Planilha */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  ID DA PLANILHA DO GOOGLE *
                </label>
                {formData.spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${formData.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir no Google Sheets
                  </a>
                )}
              </div>
              <input
                type="text"
                value={formData.spreadsheetId}
                onChange={(e) =>
                  setFormData({ ...formData, spreadsheetId: e.target.value.trim() })
                }
                placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                required
                className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Encontrado na URL da planilha: docs.google.com/spreadsheets/d/<strong>[ESTE-ID]</strong>/edit
              </p>
            </div>

            {/* ID da Pasta do Google Drive (SOLICITADO PELO USUÁRIO) */}
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderKey className="w-4 h-4 text-emerald-700" />
                  <span>ID DA PASTA DO GOOGLE DRIVE (DESTINO DOS COMPROVANTES) *</span>
                </label>
                {formData.driveFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${formData.driveFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir Pasta no Google Drive
                  </a>
                )}
              </div>
              <input
                type="text"
                value={formData.driveFolderId}
                onChange={(e) =>
                  setFormData({ ...formData, driveFolderId: e.target.value.trim() })
                }
                placeholder="Ex: 1a2B3c4D5e6F7g8H9i0J_kLmNoPqRsTuV"
                className="w-full px-3.5 py-2.5 font-mono text-xs border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white shadow-2xs"
              />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                💡 <strong>Como encontrar o ID da pasta:</strong> Abra a pasta desejada no Google Drive e copie o código final da URL: 
                <span className="font-mono ml-1 text-emerald-900 bg-emerald-100/70 px-1 py-0.5 rounded">
                  drive.google.com/drive/folders/<strong>[ID_DA_PASTA]</strong>
                </span>. Todos os arquivos de imagem ou PDF enviados serão salvos diretamente nessa pasta!
              </p>
            </div>

            {/* URL do Google Apps Script (Web App) */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                URL DO WEB APP DO GOOGLE APPS SCRIPT (GAS) *
              </label>
              <input
                type="url"
                value={formData.gasWebAppUrl}
                onChange={(e) =>
                  setFormData({ ...formData, gasWebAppUrl: e.target.value.trim() })
                }
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-slate-50/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Gerado no menu <strong>Implantar &gt; Nova implantação &gt; App da Web</strong> terminando com <code>/exec</code>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nome da Aba */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NOME DA GUIA / ABA DA PLANILHA
                </label>
                <input
                  type="text"
                  value={formData.sheetName}
                  onChange={(e) =>
                    setFormData({ ...formData, sheetName: e.target.value.trim() })
                  }
                  placeholder="Comprovantes_Pix"
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">Padrão recomendado: <code>Comprovantes_Pix</code></p>
              </div>

              {/* Token de Segurança */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  TOKEN SECRETO DA API (SECRET KEY)
                </label>
                <input
                  type="text"
                  value={formData.apiSecretToken}
                  onChange={(e) =>
                    setFormData({ ...formData, apiSecretToken: e.target.value.trim() })
                  }
                  placeholder="pix-sync-sec-2026"
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">Valida requisições autorizadas no GAS</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Senha do Administrador */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  SENHA DO PAINEL DO ADMINISTRADOR
                </label>
                <input
                  type="text"
                  value={formData.adminPassword || 'eemp2026'}
                  onChange={(e) =>
                    setFormData({ ...formData, adminPassword: e.target.value.trim() })
                  }
                  placeholder="eemp2026"
                  className="w-full px-3.5 py-2.5 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">Senha necessária para acessar o Painel Admin (padrão: <code>eemp2026</code>)</p>
              </div>

              {/* Nome da Instituição */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  NOME DA INSTITUIÇÃO / EMPRESA
                </label>
                <input
                  type="text"
                  value={formData.institutionName}
                  onChange={(e) =>
                    setFormData({ ...formData, institutionName: e.target.value })
                  }
                  placeholder="Nome do órgão ou empresa"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">Exibido no cabeçalho e relatórios</p>
              </div>
            </div>

            {/* DADOS PARA PAGAMENTO PIX DOS CLIENTES */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <span>Dados de Pagamento Pix para Clientes</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      Exibido no Portal
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Estes dados são mostrados ao cliente para que ele efetue a transferência antes de enviar o comprovante.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Favorecido */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    NOME DO FAVORECIDO (RECEBEDOR)
                  </label>
                  <input
                    type="text"
                    value={formData.pixFavorecido || 'EUNICE ABADIA MARTINS'}
                    onChange={(e) =>
                      setFormData({ ...formData, pixFavorecido: e.target.value })
                    }
                    placeholder="EUNICE ABADIA MARTINS"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Nome completo do titular da conta</p>
                </div>

                {/* URL do QR Code */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    URL DA IMAGEM DO QR CODE
                  </label>
                  <input
                    type="text"
                    value={formData.pixQrCodeUrl || 'https://i.ibb.co/N6zcpGFL/pix-eemp.png'}
                    onChange={(e) =>
                      setFormData({ ...formData, pixQrCodeUrl: e.target.value.trim() })
                    }
                    placeholder="https://i.ibb.co/N6zcpGFL/pix-eemp.png"
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Link direto da imagem do QR Code</p>
                </div>
              </div>

              {/* Copia e Cola */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CÓDIGO PIX COPIA E COLA
                </label>
                <textarea
                  rows={2}
                  value={
                    formData.pixCopiaECola ||
                    '00020101021126510014br.gov.bcb.pix0111393750566000214PGTOMARIOPORTO5204000053039865802BR5921EUNICE ABADIA MARTINS6010UBERLANDIA62070503***6304CCB3'
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, pixCopiaECola: e.target.value.trim() })
                  }
                  placeholder="00020101021126510014br.gov.bcb.pix..."
                  className="w-full px-3.5 py-2 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Código padrão EMV do Banco Central para pagamento Copia e Cola</p>
              </div>

              {/* URL do Cartaz / Instruções */}
              <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-bold text-sky-950 uppercase tracking-wider text-xs">
                    Cartaz / Imagem de Instruções (Tela de Entrada)
                  </label>
                  {(formData.cartazInstrucoesUrl || 'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png') && (
                    <a
                      href={formData.cartazInstrucoesUrl || 'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Testar / Abrir Imagem</span>
                    </a>
                  )}
                </div>
                <input
                  type="text"
                  value={
                    formData.cartazInstrucoesUrl ??
                    'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png'
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, cartazInstrucoesUrl: e.target.value.trim() })
                  }
                  placeholder="https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png"
                  className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden bg-white"
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                  <p>
                    Link da imagem exibida no botão "Dúvidas? Veja o passo-a-passo" na tela inicial antes de informar o CPF.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        cartazInstrucoesUrl: 'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png',
                      })
                    }
                    className="text-sky-700 hover:underline font-semibold shrink-0 cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                </div>

                {/* Prévia da imagem */}
                <div className="pt-2 flex items-center gap-3">
                  <img
                    src={formData.cartazInstrucoesUrl || 'https://i.ibb.co/4ZSbNDSz/Cartaz-Pagamento.png'}
                    alt="Prévia do cartaz"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-300 bg-white shadow-2xs"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800 block">Prévia do Cartaz Oficial</span>
                    <span>Esta imagem aparecerá em modal e zoom na tela de entrada do cliente.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {!resetConfirmOpen ? (
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(true)}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Restaurar parâmetros padrão do sistema"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span className="text-[11px] font-semibold text-amber-900">Restaurar padrões?</span>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-md cursor-pointer"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(false)}
                      className="px-2 py-0.5 text-slate-600 hover:text-slate-800 text-[11px] font-medium cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetCurrentAsDefault}
                  className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  title="Salvar todas as configurações atuais como o padrão oficial do sistema"
                >
                  <BookmarkCheck className="w-4 h-4 text-teal-600" />
                  <span>Definir Estado Atual como Padrão</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Salvar Configurações
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Diagnóstico e Testador de Conexão */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderSync className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Teste de Conexão GAS</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Clique para testar se a URL do seu Google Apps Script está respondendo e conectando à planilha e pasta do Google Drive.
            </p>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testResult.running}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testResult.running ? (
                <>
                  <Zap className="w-4 h-4 animate-spin text-amber-400" /> Testando Conexão...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-emerald-400" /> Testar Conexão com GAS
                </>
              )}
            </button>

            {testResult.message && (
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" /> Como Funciona o Banco de Dados:
            </span>
            <p className="text-[11px] leading-relaxed text-slate-500">
              O Google Apps Script atua como uma API Serverless gratuita e segura. Ele salva o arquivo anexo diretamente na pasta do Google Drive pelo ID informado, gera o link de acesso direto e grava a linha com todas as colunas no Google Sheets!
            </p>
          </div>
        </div>
      </div>

      {/* SEÇÃO SOLICITADA: CADASTRO DE REFERÊNCIA / DESCRIÇÃO E VALOR FIXO CORRESPONDENTE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Tabela de Referências &amp; Valores Fixos</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Cadastro de Referências e Preços do Pix
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
              Cadastre aqui os serviços, mensalidades ou taxas. Quando o cliente selecionar uma referência no envio, o valor do pagamento será preenchido automaticamente com o valor correspondente cadastrado!
            </p>
          </div>
        </div>

        {/* Formulário para Adicionar Nova Referência */}
        <form onSubmit={handleAddReference} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Adicionar Nova Referência com Valor Fixo
          </span>
          {refError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{refError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-7">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                DESCRIÇÃO / REFERÊNCIA DO PAGAMENTO *
              </label>
              <input
                type="text"
                value={newRefLabel}
                onChange={(e) => setNewRefLabel(e.target.value)}
                placeholder="Ex: Mensalidade Novembro/2026, Taxa de Carteirinha..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                required
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                VALOR FIXO (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 font-bold text-slate-400 text-xs">R$</span>
                <input
                  type="text"
                  value={newRefValor}
                  onChange={(e) => setNewRefValor(e.target.value)}
                  placeholder="150,00"
                  className="w-full pl-8 pr-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white"
                  required
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>
        </form>

        {/* Tabela de Referências Cadastradas */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">REFERÊNCIA / DESCRIÇÃO CADASTRADA</th>
                <th className="py-2.5 px-4 text-right">VALOR CORRESPONDENTE (R$)</th>
                <th className="py-2.5 px-4 text-center w-24">AÇÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(formData.referenciasPredefinidas || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
                    Nenhuma referência cadastrada ainda. Adicione uma no formulário acima.
                  </td>
                </tr>
              ) : (
                (formData.referenciasPredefinidas || []).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {item.label}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatBRL(item.valor)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover esta referência"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO SOLICITADA: ESTRUTURA COMPLETA DA PLANILHA DO GOOGLE (GUIAS E COLUNAS) */}
      <div id="estrutura-planilha" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-1.5">
              <TableProperties className="w-3.5 h-3.5" />
              <span>Especificação do Banco de Dados Google Sheets</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Estrutura da Planilha: Nome das Guias e Colunas
            </h3>
            <p className="text-xs text-slate-500 max-w-3xl mt-0.5">
              Veja exatamente como a planilha do Google deve estar estruturada para funcionar perfeitamente com o sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopySheetHeaders}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copyFeedback === 'headers' ? '✓ Cabeçalhos Copiados!' : 'Copiar Cabeçalhos (A1:J1)'}</span>
            </button>

            <button
              onClick={handleDownloadSheetTemplateCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Baixar Modelo CSV</span>
            </button>
          </div>
        </div>

        {/* Informações das Guias (Abas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Guia Principal (Obrigatória):
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded">
                {formData.sheetName || 'Comprovantes_Pix'}
              </span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Esta é a aba onde todas as transações enviadas pelos clientes são registradas. Cada nova submissão adiciona uma nova linha com os dados do comprovante e o link do Google Drive.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Criação Automática pelo Script:
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 border border-slate-200 rounded">
                100% Automático
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              O script <code>codigo.gs</code> foi desenvolvido para <strong>criar e estilizar essa guia automaticamente</strong> com cabeçalho verde escuro e texto branco na primeira execução caso ela ainda não exista!
            </p>
          </div>
        </div>

        {/* Tabela de Colunas Detalhada */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Colunas do Cabeçalho (Linha 1 da Planilha: A1 até J1)
            </span>
            <span className="text-[11px] text-slate-400">Total: 10 Colunas Padronizadas</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="py-3 px-3.5 w-16">COLUNA</th>
                  <th className="py-3 px-3.5">NOME EXATO</th>
                  <th className="py-3 px-3.5">TIPO DE DADO</th>
                  <th className="py-3 px-3.5">EXEMPLO DE VALOR</th>
                  <th className="py-3 px-3.5">DESCRIÇÃO E FINALIDADE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-sans">
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">A</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">ID</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-700">PIX-202610-8F1A02</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Identificador único gerado automaticamente pelo sistema (Chave Primária).</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">B</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">DATA_PAGAMENTO</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Data e Hora</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-700">2026-10-08T14:30</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Data e hora informadas no comprovante de transferência Pix do cliente.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">C</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">CPF</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto formatado</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-700">123.456.789-00</td>
                  <td className="py-2.5 px-3.5 text-slate-600">CPF do pagador. Garante que cada cliente consulte somente seus envios no portal.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">D</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">NOME_SERVIDOR</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto</td>
                  <td className="py-2.5 px-3.5 text-slate-700">Carlos Eduardo Oliveira</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Nome do servidor público, atendente ou setor responsável recebedor.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">E</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">REFERENCIA</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto</td>
                  <td className="py-2.5 px-3.5 text-slate-700">Matrícula 2026/2 - Taxa de Inscrição</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Mês de competência, número de processo, matrícula ou descrição da transação.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">F</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">VALOR_PAGAMENTO</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Moeda / Número</td>
                  <td className="py-2.5 px-3.5 font-mono text-emerald-700 font-bold">350.00 (R$ 350,00)</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Valor exato transferido via Pix (formatado automaticamente com R$ #,##0.00).</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">G</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">STATUS</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto</td>
                  <td className="py-2.5 px-3.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      CONFIRMADO
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">Situação: <code>PENDENTE</code>, <code>CONFIRMADO</code> ou <code>REJEITADO</code>.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">H</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">LINK_COMPROVANTE</td>
                  <td className="py-2.5 px-3.5 text-slate-600">URL / Link</td>
                  <td className="py-2.5 px-3.5 font-mono text-teal-700 underline truncate max-w-[150px]">
                    https://drive.google.com/file/d/...
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">Link direto do arquivo (imagem ou PDF) salvo na pasta indicada do Google Drive.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">I</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">DATA_REGISTRO</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Data/Hora ISO</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-700">2026-10-08T14:35:12.000Z</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Carimbo de data e hora do envio pelo portal para fins de auditoria.</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-700">J</td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">OBSERVACOES</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Texto</td>
                  <td className="py-2.5 px-3.5 text-slate-700">Conferido via extrato bancário BB</td>
                  <td className="py-2.5 px-3.5 text-slate-600">Parecer da conferência administrativa ou justificativa em caso de recusa.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CENTRAL DE CÓDIGOS PARA COPIAR: codigo.gs, index.html, GitHub CI/CD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
        {/* Navigation tabs for code view - Horizontally scrollable on mobile */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <button
              onClick={() => setActiveCodeTab('gs')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 min-h-[38px] ${
                activeCodeTab === 'gs'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Code2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>codigo.gs</span>
              <span className="hidden sm:inline">(Google Apps Script)</span>
            </button>

            <button
              onClick={() => setActiveCodeTab('html')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 min-h-[38px] ${
                activeCodeTab === 'html'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-4 h-4 text-teal-300 shrink-0" />
              <span>index.html</span>
              <span className="hidden sm:inline">(Frontend Web)</span>
            </button>

            <button
              onClick={() => setActiveCodeTab('github')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 min-h-[38px] ${
                activeCodeTab === 'github'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Github className="w-4 h-4 text-slate-200 shrink-0" />
              <span>GitHub &amp; CI/CD</span>
            </button>
          </div>

          <div>
            {activeCodeTab === 'gs' && (
              <button
                onClick={() => handleCopy(gasCode, 'codigo.gs')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copyFeedback === 'codigo.gs' ? '✓ Copiado!' : 'Copiar codigo.gs Completo'}</span>
              </button>
            )}

            {activeCodeTab === 'html' && (
              <button
                onClick={() => handleCopy(indexHtml, 'index.html')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-900 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copyFeedback === 'index.html' ? '✓ Copiado!' : 'Copiar index.html Completo'}</span>
              </button>
            )}

            {activeCodeTab === 'github' && (
              <button
                onClick={() => handleCopy(githubWorkflow, 'deploy-gas.yml')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copyFeedback === 'deploy-gas.yml' ? '✓ Copiado!' : 'Copiar Workflow GitHub'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Code Content Display */}
        <div className="p-4 sm:p-6 bg-slate-950 font-mono text-xs text-emerald-400 max-h-[500px] overflow-y-auto leading-relaxed select-all">
          {activeCodeTab === 'gs' && <pre>{gasCode}</pre>}
          {activeCodeTab === 'html' && <pre>{indexHtml}</pre>}
          {activeCodeTab === 'github' && (
            <div className="space-y-6">
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  1. Arquivo de Configuração do Clasp (.clasp.json):
                </span>
                <pre className="text-teal-300 bg-slate-900 p-4 rounded-xl">{claspJson}</pre>
              </div>
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  2. GitHub Actions CI/CD (.github/workflows/deploy-gas.yml):
                </span>
                <pre className="text-slate-200 bg-slate-900 p-4 rounded-xl">{githubWorkflow}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GUIA PASSO A PASSO DE IMPLANTAÇÃO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="font-extrabold text-slate-900 text-lg">
            Guia Rápido: Como Publicar no Google Sheets e Drive em 5 Minutos
          </h3>
          <p className="text-xs text-slate-500">
            Siga os passos abaixo para conectar este sistema à sua conta do Google:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              1
            </span>
            <h4 className="font-bold text-slate-800">Criar Planilha &amp; Pasta</h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Crie uma planilha em <strong>sheets.new</strong> e uma pasta no <strong>Google Drive</strong> para os comprovantes. Copie os IDs das URLs e preencha nos campos acima.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              2
            </span>
            <h4 className="font-bold text-slate-800">Abrir o Apps Script</h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              No menu superior da planilha, clique em <strong>Extensões &gt; Apps Script</strong>. Uma nova aba do editor de código do Google será aberta.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              3
            </span>
            <h4 className="font-bold text-slate-800">Colar o codigo.gs</h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Substitua o conteúdo de <code>Código.gs</code> colando o código completo da aba acima. Clique no ícone de disquete para Salvar.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              4
            </span>
            <h4 className="font-bold text-slate-800">Implantar como Web App</h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Clique em <strong>Implantar &gt; Nova implantação</strong>. Escolha tipo <strong>App da Web</strong>. Em "Quem tem acesso", escolha <strong>Qualquer pessoa</strong>. Copie o URL e cole no painel!
            </p>
          </div>
        </div>
      </div>

      {/* GUIA PASSO A PASSO: DEPLOY NO GITHUB & GITHUB PAGES */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Github className="w-6 h-6 text-emerald-400" />
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Passo a Passo: Como Fazer o Deploy que Funciona no GitHub
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Guia completo e testado para colocar este sistema no ar via GitHub Pages de forma 100% gratuita
            </p>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-3 py-1 rounded-full self-start sm:self-center">
            Vite base: './' Configurado
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Etapa 1 */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px]">1</span>
              <span>Criar o Repositório no GitHub</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Acesse <strong>github.com/new</strong> e crie um novo repositório (ex: <code>envio-comprovantes-pix</code>). Pode ser Público ou Privado. Não marque a opção de adicionar README para não gerar conflito.
            </p>
          </div>

          {/* Etapa 2 */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px]">2</span>
              <span>Subir os Arquivos (Sem Terminal)</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>Opção A (100% no Navegador):</strong> Na página do repositório no GitHub, clique em <strong>Add file &gt; Upload files</strong>. Arraste todos os arquivos e pastas do projeto e clique em <strong>Commit changes</strong>.
            </p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>Opção B (GitHub Desktop):</strong> Abra o app visual <strong>GitHub Desktop</strong>, clique em <em>Add &gt; Add Existing Repository</em>, selecione a pasta e clique no botão azul <em>Publish repository</em> (tudo com cliques, sem comandos).
            </p>
          </div>

          {/* Etapa 3 */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px]">3</span>
              <span>Ativar GitHub Pages via Actions</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              No GitHub, vá em <strong>Settings &gt; Pages</strong> (menu lateral). No campo <strong>Build and deployment &gt; Source</strong>, escolha <strong>GitHub Actions</strong>.
            </p>
            <p className="text-slate-400 text-[10px]">
              O arquivo <code>.github/workflows/deploy.yml</code> incluído no projeto fará o build e publicação automaticamente a cada push!
            </p>
          </div>

          {/* Etapa 4 */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px]">4</span>
              <span>Pronto! Acessar o Link Público</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Em cerca de 1 a 2 minutos, o GitHub disponibilizará o link no topo da aba <strong>Settings &gt; Pages</strong> (ex: <code>https://SEU_USUARIO.github.io/SEU_REPO/</code>).
            </p>
            <p className="text-emerald-300 text-[10px] font-semibold">
              ✓ Graças ao <code>base: './'</code> configurado no <code>vite.config.ts</code>, scripts e imagens carregarão perfeitamente sem tela branca.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <p className="font-bold text-slate-200">Alternativa com Vercel / Netlify / Render (Ainda Mais Fácil):</p>
          <p className="text-[11px]">
            Você também pode entrar em <strong>vercel.com</strong> ou <strong>netlify.com</strong>, conectar sua conta do GitHub, selecionar este repositório e clicar em "Deploy". As configurações padrão (<code>npm run build</code> e pasta de saída <code>dist</code>) funcionam de primeira!
          </p>
        </div>
      </div>
    </div>
  );
};
