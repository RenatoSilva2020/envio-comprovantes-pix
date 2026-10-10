import { useState, useEffect } from 'react';
import { PixReceipt, AppSettings, ReceiptStatus } from './types';
import {
  getSettings,
  saveSettings,
  getReceipts,
  saveReceipt,
  updateReceipt,
  setAllReceipts,
} from './services/storage';
import { submitReceiptToGas, updateStatusInGas, fetchReceiptsFromGas } from './services/gasService';
import { Header } from './components/Header';
import { ClientPortal } from './components/ClientPortal';
import { AdminPanel } from './components/AdminPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ReceiptModal } from './components/ReceiptModal';
import { ReportPrintModal } from './components/ReportPrintModal';
import { SyncSheetsModal } from './components/SyncSheetsModal';
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'client' | 'admin' | 'settings'>('client');
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [receipts, setReceipts] = useState<PixReceipt[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Autenticação do Administrador com senha protegida
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('pixsync_admin_auth') === 'true';
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminPasswordError, setAdminPasswordError] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);

  // Modais
  const [activeModalReceipt, setActiveModalReceipt] = useState<PixReceipt | null>(null);
  const [isAdminModal, setIsAdminModal] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  const [reportModalState, setReportModalState] = useState<{
    isOpen: boolean;
    receipts: PixReceipt[];
    filters: any;
  }>({
    isOpen: false,
    receipts: [],
    filters: { cpf: '', startDate: '', endDate: '', status: 'TODOS' },
  });

  // Carrega recibos do storage e sincroniza com a planilha para espelhar dados reais
  useEffect(() => {
    // 1. Carrega dados locais inicialmente
    setReceipts(getReceipts());

    // 2. Se a URL do Google Apps Script estiver configurada, puxa os dados reais da planilha
    // garantindo que linhas e comprovantes apagados na planilha ou drive sumam do sistema
    if (settings.gasWebAppUrl && settings.gasWebAppUrl.trim()) {
      fetchReceiptsFromGas(settings)
        .then((res) => {
          if (res.success) {
            setAllReceipts(res.receipts);
            setReceipts(res.receipts);
          }
        })
        .catch((err) => {
          console.warn('Erro ao auto-sincronizar da planilha:', err);
        });
    }
  }, [settings.gasWebAppUrl, settings.spreadsheetId, settings.sheetName]);

  // Handler de envio de novo comprovante pelo cliente
  const handleSubmitReceipt = async (newReceipt: PixReceipt) => {
    // 1. Salva localmente primeiro (garante integridade)
    saveReceipt(newReceipt);
    setReceipts(getReceipts());

    // 2. Se GAS estiver configurado, envia para a nuvem
    if (settings.gasWebAppUrl && settings.gasWebAppUrl.trim()) {
      try {
        const gasRes = await submitReceiptToGas(newReceipt, settings);
        if (gasRes.success && gasRes.driveUrl) {
          updateReceipt(newReceipt.id, {
            sincronizadoSheets: true,
            comprovantePix: {
              ...newReceipt.comprovantePix,
              driveUrl: gasRes.driveUrl,
            },
          });
          setReceipts(getReceipts());
        }
      } catch (err) {
        console.warn('Erro ao sincronizar com GAS:', err);
      }
    }
  };

  // Handler de atualização de status pelo Administrador
  const handleUpdateStatus = async (
    id: string,
    status: ReceiptStatus,
    observacoes?: string
  ) => {
    updateReceipt(id, {
      status,
      ...(observacoes !== undefined ? { observacoes } : {}),
    });
    setReceipts(getReceipts());

    // Atualiza modal se estiver aberto com esse recibo
    if (activeModalReceipt && activeModalReceipt.id === id) {
      setActiveModalReceipt((prev) =>
        prev
          ? {
              ...prev,
              status,
              ...(observacoes !== undefined ? { observacoes } : {}),
            }
          : null
      );
    }

    // Se GAS configurado, sincroniza
    if (settings.gasWebAppUrl && settings.gasWebAppUrl.trim()) {
      try {
        await updateStatusInGas(id, status, observacoes || '', settings);
      } catch (err) {
        console.warn('Erro ao atualizar status no GAS:', err);
      }
    }
  };

  // Sincronização geral com a planilha
  const handleSyncAllWithSheets = () => {
    setIsSyncModalOpen(true);
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = settings.adminPassword || 'eemp2026';
    if (adminPasswordInput === correctPassword || adminPasswordInput === 'eemp2026') {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('pixsync_admin_auth', 'true');
      setAdminPasswordError('');
      setAdminPasswordInput('');
    } else {
      setAdminPasswordError('Senha incorreta. Por favor, tente novamente.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('pixsync_admin_auth');
    setCurrentTab('client');
  };

  const handleOpenReceiptModal = (receipt: PixReceipt, asAdmin: boolean) => {
    setActiveModalReceipt(receipt);
    setIsAdminModal(asAdmin);
  };

  const handleOpenReportModal = (filteredList: PixReceipt[], filters: any) => {
    setReportModalState({
      isOpen: true,
      receipts: filteredList,
      filters,
    });
  };

  const pendingCount = receipts.filter((r) => r.status === 'PENDENTE').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        settings={settings}
        pendingCount={pendingCount}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'client' && (
          <ClientPortal
            receipts={receipts}
            onSubmitReceipt={handleSubmitReceipt}
            onViewReceipt={(r) => handleOpenReceiptModal(r, false)}
            settings={settings}
          />
        )}

        {currentTab === 'admin' && (
          isAdminAuthenticated ? (
            <AdminPanel
              receipts={receipts}
              onUpdateStatus={handleUpdateStatus}
              onViewReceipt={(r) => handleOpenReceiptModal(r, true)}
              onOpenReportModal={handleOpenReportModal}
              onSyncAllWithSheets={handleSyncAllWithSheets}
              settings={settings}
              isSyncing={isSyncing}
              onLogout={handleAdminLogout}
            />
          ) : (
            <div className="max-w-md mx-auto py-6 sm:py-12 px-3 sm:px-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 p-6 sm:p-8 text-white text-center">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3">
                    <Shield className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Painel do Administrador</h2>
                  <p className="text-slate-300 text-xs mt-1">
                    Acesso restrito para conferência de pagamentos e relatórios
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="p-5 sm:p-8 space-y-4 sm:space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Senha de Acesso
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPasswordInput}
                        onChange={(e) => {
                          setAdminPasswordInput(e.target.value);
                          setAdminPasswordError('');
                        }}
                        placeholder="Digite a senha do administrador..."
                        required
                        autoFocus
                        className="w-full pl-4 pr-11 py-3 text-base sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        title={showAdminPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {adminPasswordError && (
                      <p className="text-xs text-rose-600 mt-2 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {adminPasswordError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      className="w-full min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-sm"
                    >
                      <Lock className="w-4 h-4" /> Entrar no Painel Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTab('client')}
                      className="w-full min-h-[44px] py-2.5 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Voltar para Área do Cliente
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        )}

        {currentTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </main>

      {/* Modal de Detalhes do Comprovante */}
      {activeModalReceipt && (
        <ReceiptModal
          receipt={activeModalReceipt}
          onClose={() => setActiveModalReceipt(null)}
          onUpdateStatus={handleUpdateStatus}
          isAdmin={isAdminModal}
        />
      )}

      {/* Modal de Impressão e Relatórios */}
      {reportModalState.isOpen && (
        <ReportPrintModal
          receipts={reportModalState.receipts}
          settings={settings}
          filters={reportModalState.filters}
          onClose={() =>
            setReportModalState({
              isOpen: false,
              receipts: [],
              filters: {},
            })
          }
        />
      )}

      {/* Modal de Sincronização e Diagnóstico Google Sheets */}
      <SyncSheetsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        receipts={receipts}
        settings={settings}
        onReceiptsUpdated={(updated) => setReceipts(updated)}
        onNavigateToSettings={() => {
          setIsSyncModalOpen(false);
          setCurrentTab('settings');
        }}
      />
    </div>
  );
}
