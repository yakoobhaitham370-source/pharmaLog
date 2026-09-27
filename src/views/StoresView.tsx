import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Storefront as StoreIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Sync as SyncIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { MasterInvoiceRow, StoreSummary } from '../types';
import { getStoreSummaries, formatIQD, getSpreadsheetUrl } from '../services/googleWorkspace';

interface StoresViewProps {
  knownStores: string[];
  masterRows: MasterInvoiceRow[];
  onAddStore: (storeName: string) => void;
  onRenameStore: (oldName: string, newName: string) => void;
  onDeleteStore: (storeName: string) => void;
  onFilterByStore: (storeName: string) => void;
  onSync?: (silent?: boolean) => Promise<void> | void;
  isSyncing?: boolean;
}

export const StoresView: React.FC<StoresViewProps> = ({
  knownStores,
  masterRows,
  onAddStore,
  onRenameStore,
  onDeleteStore,
  onFilterByStore,
  onSync,
  isSyncing = false,
}) => {
  // Store action dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [newStoreName, setNewStoreName] = useState('');
  const [targetStore, setTargetStore] = useState<string>('');
  const [renamedValue, setRenamedValue] = useState<string>('');

  // Context menu for individual store card
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeMenuStore, setActiveMenuStore] = useState<string | null>(null);

  // Calculate cumulative store summaries
  const storeSummaries: StoreSummary[] = useMemo(() => {
    return getStoreSummaries(masterRows, knownStores);
  }, [masterRows, knownStores]);

  const grandTotalAllStores = useMemo(() => {
    return storeSummaries.reduce((sum, s) => sum + s.runningTotal, 0);
  }, [storeSummaries]);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, store: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setActiveMenuStore(store);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setActiveMenuStore(null);
  };

  const handleStartRename = () => {
    if (activeMenuStore) {
      setTargetStore(activeMenuStore);
      setRenamedValue(activeMenuStore);
      setRenameDialogOpen(true);
    }
    handleCloseMenu();
  };

  const handleStartDelete = () => {
    if (activeMenuStore) {
      setTargetStore(activeMenuStore);
      setDeleteDialogOpen(true);
    }
    handleCloseMenu();
  };

  const handleConfirmAdd = () => {
    const trimmed = newStoreName.trim();
    if (trimmed) {
      onAddStore(trimmed);
      setNewStoreName('');
      setAddDialogOpen(false);
    }
  };

  const handleConfirmRename = () => {
    const trimmed = renamedValue.trim();
    if (trimmed && targetStore) {
      onRenameStore(targetStore, trimmed);
      setRenameDialogOpen(false);
      setTargetStore('');
    }
  };

  const handleConfirmDelete = () => {
    if (targetStore) {
      onDeleteStore(targetStore);
      setDeleteDialogOpen(false);
      setTargetStore('');
    }
  };

  return (
    <Box sx={{ pb: 12, px: { xs: 2, sm: 3 }, pt: 2, maxWidth: 640, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Pharmacy Distributors
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Store tabs & cumulative running totals
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onSync && (
            <Button
              variant="outlined"
              size="small"
              startIcon={isSyncing ? <CircularProgress size={14} /> : <SyncIcon />}
              onClick={() => onSync(false)}
              disabled={isSyncing}
              sx={{ borderRadius: 2.5, fontWeight: 600, color: '#0f766e', borderColor: '#99f6e4' }}
            >
              {isSyncing ? 'Syncing...' : 'Sync Sheet'}
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 700 }}
          >
            Add Store
          </Button>
        </Box>
      </Box>

      {/* Cumulative Grand Total Card */}
      {knownStores.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3.5,
            background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
            color: '#ffffff',
            mb: 3,
            boxShadow: '0 8px 20px rgba(15, 118, 110, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#ccfbf1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                All Stores Cumulative Sum
              </Typography>
              <Typography variant="h4" className="font-mono-num" sx={{ fontWeight: 800, color: '#ffffff', mt: 0.5 }}>
                {formatIQD(grandTotalAllStores)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#e0f2fe', mt: 0.5, display: 'block' }}>
                {knownStores.length} registered distributor store tabs in Google Sheets
              </Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 32, color: '#ffffff' }} />
            </Box>
          </Box>
        </Paper>
      )}

      {/* Store Summaries List */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
        Distributor Directory & Sheet Tabs ({knownStores.length})
      </Typography>

      <Stack spacing={2}>
        {storeSummaries.map((summary) => (
          <Paper
            key={summary.name}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#99f6e4',
                boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <StoreIcon sx={{ fontSize: 20, color: '#0f766e' }} />
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: 'Cairo, Plus Jakarta Sans, sans-serif',
                    }}
                  >
                    {summary.name}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>Google Sheet Tab: <b>'{summary.name.replace(/[\\/?*:[\]]/g, '-').slice(0, 30)}'</b></span>
                </Typography>
              </Box>

              <IconButton size="small" onClick={(e) => handleOpenMenu(e, summary.name)} sx={{ color: '#64748b' }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Financial metrics for this store */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                  INVOICE ITEMS
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                  {summary.itemCount} line items
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, display: 'block', fontSize: '0.7rem' }}>
                  STORE RUNNING TOTAL
                </Typography>
                <Typography variant="subtitle1" className="font-mono-num" sx={{ fontWeight: 800, color: '#0f766e' }}>
                  {formatIQD(summary.runningTotal)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}

        {knownStores.length === 0 && (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <StoreIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#475569' }}>
              No distributor stores yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Add your pharmacy suppliers or sync with Google Sheets to load your existing store tabs.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Add Store
              </Button>
              {onSync && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isSyncing ? <CircularProgress size={14} /> : <SyncIcon />}
                  onClick={() => onSync(false)}
                  disabled={isSyncing}
                  sx={{ borderRadius: 2, color: '#0f766e', borderColor: '#99f6e4' }}
                >
                  {isSyncing ? 'Syncing...' : 'Sync from Google Sheet'}
                </Button>
              )}
            </Box>
          </Paper>
        )}
      </Stack>

      {/* Store options context menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>
        <MenuItem onClick={handleStartRename}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename Store</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStartDelete} sx={{ color: '#dc2626' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: '#dc2626' }} />
          </ListItemIcon>
          <ListItemText>Delete Store</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Store Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Known Store</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add a drug company or distributor name to help Gemini auto-match incoming invoices.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Store / Distributor Name"
            placeholder="e.g. Al-Hikma Pharma - الحكمة"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmAdd} variant="contained" disabled={!newStoreName.trim()}>
            Save Store
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Store Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Rename Distributor</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Store Name"
            value={renamedValue}
            onChange={(e) => setRenamedValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmRename} variant="contained" disabled={!renamedValue.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Store Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626' }}>Remove Store?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to remove <b>"{targetStore}"</b> from your known stores list? Existing logged rows in Google Sheets will remain intact.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
