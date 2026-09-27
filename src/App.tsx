/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  CssBaseline,
  Box,
  Fab,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import { muiTheme } from './theme/muiTheme';
import { ExtractedInvoice, MasterInvoiceRow } from './types';
import {
  getStoredKnownStores,
  saveStoredKnownStores,
  getLocalMasterRows,
  syncFromGoogleWorkspace,
} from './services/googleWorkspace';
import { fileToBase64, extractInvoiceFromImage } from './services/geminiExtraction';
import { getCurrentUser } from './services/firebaseAuth';

import { AppHeader } from './components/AppHeader';
import { BottomNavBar } from './components/BottomNavBar';
import { CaptureView } from './views/CaptureView';
import { ExtractionReviewSheet } from './views/ExtractionReviewSheet';
import { SearchView } from './views/SearchView';
import { StoresView } from './views/StoresView';
import { BulkImportView } from './views/BulkImportView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'capture' | 'search' | 'stores' | 'bulk'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pharmalog_active_tab');
      if (saved === 'search' || saved === 'stores' || saved === 'bulk' || saved === 'capture') {
        return saved;
      }
    }
    return 'capture';
  });

  const handleTabChange = (newTab: 'capture' | 'search' | 'stores' | 'bulk') => {
    setCurrentTab(newTab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharmalog_active_tab', newTab);
    }
  };

  // Application State
  const [knownStores, setKnownStores] = useState<string[]>([]);
  const [masterRows, setMasterRows] = useState<MasterInvoiceRow[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Review State
  const [activeInvoice, setActiveInvoice] = useState<ExtractedInvoice | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Snackbar notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // FAB camera trigger
  const fabCameraInputRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    setKnownStores(getStoredKnownStores());
    setMasterRows(getLocalMasterRows());

    // Auto-sync if user is logged in
    if (getCurrentUser()) {
      handleSyncData(true);
    }
  }, []);

  const refreshData = () => {
    setKnownStores(getStoredKnownStores());
    setMasterRows(getLocalMasterRows());
  };

  const handleSyncData = async (silent: boolean = false) => {
    setIsSyncing(true);
    try {
      const res = await syncFromGoogleWorkspace();
      if (res.success) {
        setKnownStores(res.stores);
        setMasterRows(res.rows);
        if (!silent) {
          setSnackbar({
            open: true,
            message: res.message,
            severity: 'success',
          });
        }
      } else {
        if (!silent) {
          setSnackbar({
            open: true,
            message: res.message,
            severity: 'info',
          });
        }
      }
    } catch (err: any) {
      if (!silent) {
        setSnackbar({
          open: true,
          message: err?.message || 'Sync encountered an issue',
          severity: 'error',
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Invoice extracted -> Open Bottom Sheet Review
  const handleInvoiceExtracted = (invoice: ExtractedInvoice) => {
    setActiveInvoice(invoice);
    setIsReviewOpen(true);
  };

  // Successful save from Review Sheet
  const handleInvoiceSaved = (storeName: string, rowsCount: number) => {
    refreshData();
    setSnackbar({
      open: true,
      message: `Successfully logged ${rowsCount} drug lines for "${storeName}" to Google Sheet & Drive!`,
      severity: 'success',
    });
  };

  // Store management
  const handleAddStore = (storeName: string) => {
    const updated = [...knownStores, storeName];
    setKnownStores(updated);
    saveStoredKnownStores(updated);
    setSnackbar({
      open: true,
      message: `Added store "${storeName}"`,
      severity: 'success',
    });
  };

  const handleRenameStore = (oldName: string, newName: string) => {
    const updated = knownStores.map((s) => (s === oldName ? newName : s));
    setKnownStores(updated);
    saveStoredKnownStores(updated);

    // Update matching master rows
    const updatedRows = masterRows.map((r) =>
      r.store === oldName ? { ...r, store: newName } : r
    );
    setMasterRows(updatedRows);
    localStorage.setItem('pharmalog_local_master_rows', JSON.stringify(updatedRows));

    setSnackbar({
      open: true,
      message: `Renamed "${oldName}" to "${newName}"`,
      severity: 'success',
    });
  };

  const handleDeleteStore = (storeName: string) => {
    const updated = knownStores.filter((s) => s !== storeName);
    setKnownStores(updated);
    saveStoredKnownStores(updated);
    setSnackbar({
      open: true,
      message: `Removed "${storeName}" from known list`,
      severity: 'info',
    });
  };

  const handleFilterByStore = (_storeName: string) => {
    setCurrentTab('search');
  };

  // Quick FAB photo capture handler
  const handleFabCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSnackbar({
        open: true,
        message: 'Analyzing invoice with Gemini AI...',
        severity: 'info',
      });
      const base64 = await fileToBase64(file);
      const res = await extractInvoiceFromImage(base64, file.type || 'image/jpeg', knownStores);
      if (res.success && res.data) {
        handleInvoiceExtracted(res.data);
      } else {
        setSnackbar({
          open: true,
          message: res.error || 'Failed to extract invoice.',
          severity: 'error',
        });
      }
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: 'Could not process captured photo.',
        severity: 'error',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
        {/* App Bar Header */}
        <AppHeader
          onRefreshData={refreshData}
          onSync={handleSyncData}
          isSyncing={isSyncing}
        />

        {/* Hidden Camera Input for FAB */}
        <input
          ref={fabCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFabCapture}
        />

        {/* Main Content Area */}
        <Box sx={{ flex: 1 }}>
          {currentTab === 'capture' && (
            <CaptureView
              knownStores={knownStores}
              recentRows={masterRows}
              onInvoiceExtracted={handleInvoiceExtracted}
              onNavigateToSearch={() => handleTabChange('search')}
              onNavigateToStores={() => handleTabChange('stores')}
              onNavigateToBulk={() => handleTabChange('bulk')}
            />
          )}

          {currentTab === 'search' && (
            <SearchView
              masterRows={masterRows}
              knownStores={knownStores}
              onSync={handleSyncData}
              isSyncing={isSyncing}
              onNavigateToCapture={() => handleTabChange('capture')}
            />
          )}

          {currentTab === 'stores' && (
            <StoresView
              knownStores={knownStores}
              masterRows={masterRows}
              onAddStore={handleAddStore}
              onRenameStore={handleRenameStore}
              onDeleteStore={handleDeleteStore}
              onFilterByStore={handleFilterByStore}
              onSync={handleSyncData}
              isSyncing={isSyncing}
            />
          )}

          {currentTab === 'bulk' && (
            <BulkImportView
              knownStores={knownStores}
              onBatchSaved={(count) => {
                refreshData();
                setSnackbar({
                  open: true,
                  message: `Successfully logged ${count} invoices into Google Sheets!`,
                  severity: 'success',
                });
                handleTabChange('search');
              }}
            />
          )}
        </Box>

        {/* Floating Action Button (FAB) for quick capture (Material Design 3) */}
        {currentTab !== 'capture' && (
          <Tooltip title="Quick Capture Invoice" placement="left">
            <Fab
              color="primary"
              onClick={() => fabCameraInputRef.current?.click()}
              sx={{
                position: 'fixed',
                bottom: 80,
                right: 20,
                zIndex: 900,
                bgcolor: '#0f766e',
                '&:hover': { bgcolor: '#115e59' },
              }}
            >
              <CameraIcon />
            </Fab>
          </Tooltip>
        )}

        {/* Extraction Review Bottom Sheet */}
        <ExtractionReviewSheet
          open={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          invoice={activeInvoice}
          knownStores={knownStores}
          onInvoiceSaved={handleInvoiceSaved}
          onAddNewStore={handleAddStore}
        />

        {/* Bottom Navigation Bar */}
        <BottomNavBar currentTab={currentTab} onTabChange={handleTabChange} />

        {/* Global Snackbar for confirmations & errors */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4500}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%', borderRadius: 3, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
