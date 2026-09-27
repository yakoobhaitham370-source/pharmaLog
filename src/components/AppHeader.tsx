import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Divider,
  TextField,
  Collapse,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  LocalPharmacy as PharmacyIcon,
  CloudDone as CloudDoneIcon,
  CloudQueue as CloudQueueIcon,
  InfoOutlined as InfoIcon,
  TableChart as SheetIcon,
  FolderOpen as DriveIcon,
  FileDownload as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Settings as SettingsIcon,
  Check as CheckIcon,
  Logout as LogoutIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import {
  getStoredWorkspaceAuth,
  getLocalMasterRows,
  exportInvoicesToCSV,
  saveCustomWorkspaceLinks,
  getSpreadsheetUrl,
  getDriveFolderUrl,
} from '../services/googleWorkspace';
import { googleSignIn, initAuth, logout, getCurrentUser } from '../services/firebaseAuth';
import { User } from 'firebase/auth';

interface AppHeaderProps {
  onRefreshData?: () => void;
  onSync?: (silent?: boolean) => Promise<void> | void;
  isSyncing?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onRefreshData, onSync, isSyncing = false }) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [auth, setAuth] = useState(getStoredWorkspaceAuth());
  const [showConfig, setShowConfig] = useState(false);
  const [customSheetInput, setCustomSheetInput] = useState(auth.spreadsheetId || '');
  const [customDriveInput, setCustomDriveInput] = useState(auth.driveFolderId || '');
  const [geminiKeyInput, setGeminiKeyInput] = useState(localStorage.getItem('gemini_api_key') || '');
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const handleOpenInfo = () => {
    const currentAuth = getStoredWorkspaceAuth();
    setAuth(currentAuth);
    setCustomSheetInput(currentAuth.spreadsheetId || '');
    setCustomDriveInput(currentAuth.driveFolderId || '');
    setGeminiKeyInput(localStorage.getItem('gemini_api_key') || '');
    setInfoOpen(true);
  };

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setCurrentUser(user);
        setAuth(getStoredWorkspaceAuth());
        if (onSync) onSync(true);
      },
      () => {
        setCurrentUser(null);
        setAuth(getStoredWorkspaceAuth());
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setSignInError(null);
    try {
      const res = await googleSignIn();
      setCurrentUser(res.user);
      setAuth(getStoredWorkspaceAuth());
      if (onSync) {
        await onSync(false);
      } else if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setSignInError(
          `Domain "${window.location.hostname}" is not authorized. Please add "${window.location.hostname}" in Firebase Console > Authentication > Settings > Authorized domains.`
        );
      } else {
        setSignInError(err?.message || 'Google sign in failed. Please ensure popups are allowed.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAuth(getStoredWorkspaceAuth());
    if (onRefreshData) onRefreshData();
  };

  const handleSaveGeminiKey = () => {
    if (geminiKeyInput.trim()) {
      localStorage.setItem('gemini_api_key', geminiKeyInput.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setSavedKeySuccess(true);
    setTimeout(() => setSavedKeySuccess(false), 2000);
  };

  const handleSaveCustomLinks = () => {
    saveCustomWorkspaceLinks(customSheetInput, customDriveInput);
    setAuth(getStoredWorkspaceAuth());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    if (onRefreshData) onRefreshData();
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: 64 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                bgcolor: 'primary.main',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(15, 118, 110, 0.25)',
              }}
            >
              <PharmacyIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2, color: '#0f172a' }}>
                Pharma<span className="text-teal-600">Log</span>
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                Supplier Invoice Logger
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentUser && onSync && (
              <IconButton
                size="small"
                onClick={() => onSync(false)}
                disabled={isSyncing}
                title="Sync from Google Sheets"
                sx={{
                  color: '#0f766e',
                  bgcolor: '#f0fdfa',
                  border: '1px solid #99f6e4',
                  '&:hover': { bgcolor: '#ccfbf1' },
                }}
              >
                {isSyncing ? (
                  <CircularProgress size={18} sx={{ color: '#0f766e' }} />
                ) : (
                  <SyncIcon fontSize="small" />
                )}
              </IconButton>
            )}

            <Chip
              icon={currentUser ? <CloudDoneIcon sx={{ fontSize: '16px !important' }} /> : <CloudQueueIcon sx={{ fontSize: '16px !important' }} />}
              label={currentUser ? 'Google Connected' : 'Connect Google Drive'}
              size="small"
              onClick={handleOpenInfo}
              color={currentUser ? 'primary' : 'default'}
              variant={currentUser ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                bgcolor: currentUser ? '#f0fdfa' : undefined,
                color: currentUser ? '#0f766e' : undefined,
                borderColor: currentUser ? '#99f6e4' : '#cbd5e1',
                '& .MuiChip-icon': {
                  color: currentUser ? '#0f766e' : '#64748b',
                },
              }}
            />

            <IconButton size="small" onClick={handleOpenInfo} sx={{ color: '#64748b' }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Google Workspace & App Info Dialog */}
      <Dialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PharmacyIcon color="primary" /> Google Sheets & Drive Connection
          </Box>
          <IconButton size="small" onClick={() => setShowConfig(!showConfig)} sx={{ color: '#64748b' }}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect your Google account to automatically create and sync the <b>"Pharmacy Supplier Invoices - Master Log"</b> spreadsheet and <b>"PharmaLog Invoices"</b> photo archive folder in your Google Drive.
          </Typography>

          {/* Sign In button if not logged in */}
          {!currentUser ? (
            <Box sx={{ mb: 2.5, p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', mb: 1.5 }}>
                Sign in with your Google Account to create the Sheet & Folder:
              </Typography>
              
              <Button
                variant="outlined"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                startIcon={
                  signingIn ? (
                    <CircularProgress size={18} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )
                }
                sx={{
                  py: 1.2,
                  px: 3,
                  bgcolor: '#ffffff',
                  borderColor: '#cbd5e1',
                  color: '#1e293b',
                  fontWeight: 700,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
                }}
              >
                {signingIn ? 'Connecting to Google...' : 'Sign in with Google'}
              </Button>

              {signInError && (
                <Alert severity="error" sx={{ mt: 1.5, textAlign: 'left', borderRadius: 2 }}>
                  {signInError}
                </Alert>
              )}
            </Box>
          ) : (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0fdfa', borderRadius: 2.5, border: '1px solid #99f6e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, display: 'block' }}>
                  SIGNED IN ACCOUNT
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentUser.email}
                </Typography>
              </Box>
              <Button size="small" color="inherit" onClick={handleLogout} startIcon={<LogoutIcon fontSize="small" />} sx={{ color: '#64748b' }}>
                Disconnect
              </Button>
            </Box>
          )}

          <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 3, border: '1px solid #e2e8f0', mb: 2 }}>
            {/* Google Sheets Link & Card */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SheetIcon sx={{ color: '#0f766e' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    GOOGLE SPREADSHEET
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {auth.spreadsheetName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Tabs: Store running totals & "All Invoices" flat master log
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                href={getSpreadsheetUrl()}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ borderRadius: 2, fontSize: '0.75rem', fontWeight: 600 }}
              >
                Open Sheets
              </Button>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Google Drive Link & Card */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DriveIcon sx={{ color: '#0284c7' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    GOOGLE DRIVE ARCHIVE
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {auth.driveFolderName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Folder holding original invoice photos
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="outlined"
                href={getDriveFolderUrl()}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ borderRadius: 2, fontSize: '0.75rem', fontWeight: 600 }}
              >
                Open Drive
              </Button>
            </Box>
          </Box>

          {/* Optional custom Sheet / Folder URL mapping and Gemini API Key */}
          <Collapse in={showConfig}>
            <Box sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #cbd5e1', mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block', mb: 0.5 }}>
                GEMINI AI API KEY (FOR INVOICE OCR EXTRACTION)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                Get your free API key from{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0f766e', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Google AI Studio (aistudio.google.com)
                </a>{' '}
                (starts with <code>AIzaSy...</code>)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label="Gemini API Key"
                  placeholder="AIzaSy..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveGeminiKey}
                  startIcon={savedKeySuccess ? <CheckIcon /> : undefined}
                  color={savedKeySuccess ? 'success' : 'primary'}
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap', px: 2 }}
                >
                  {savedKeySuccess ? 'Saved!' : 'Save Key'}
                </Button>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block', mb: 1 }}>
                CUSTOM GOOGLE SHEET OR DRIVE FOLDER LINK (OPTIONAL)
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Your Google Spreadsheet URL or ID"
                placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/..."
                value={customSheetInput}
                onChange={(e) => setCustomSheetInput(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Your Google Drive Folder URL or ID"
                placeholder="https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
                value={customDriveInput}
                onChange={(e) => setCustomDriveInput(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveCustomLinks}
                startIcon={savedSuccess ? <CheckIcon /> : undefined}
                color={savedSuccess ? 'success' : 'primary'}
                sx={{ fontWeight: 600 }}
              >
                {savedSuccess ? 'Saved Links!' : 'Save Custom Links'}
              </Button>
            </Box>
          </Collapse>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {currentUser && onSync && (
            <Button
              onClick={() => onSync(false)}
              disabled={isSyncing}
              variant="outlined"
              startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
              sx={{ flex: { xs: '100%', sm: 1 }, color: '#0f766e', borderColor: '#99f6e4' }}
            >
              {isSyncing ? 'Syncing...' : 'Sync Sheet & Drive'}
            </Button>
          )}
          <Button
            onClick={() => exportInvoicesToCSV(getLocalMasterRows())}
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ flex: 1 }}
          >
            Export Sheet (.csv)
          </Button>
          <Button onClick={() => setInfoOpen(false)} variant="contained" sx={{ flex: 1 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
