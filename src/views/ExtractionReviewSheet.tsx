import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as SaveIcon,
  Storefront as StoreIcon,
  CalendarMonth as DateIcon,
  Image as ImageIcon,
  ReceiptLong as ReceiptIcon,
  Autorenew as RecomputeIcon,
  Help as UncertainIcon,
  AddBusiness as AddStoreIcon,
  Refresh as RetryIcon,
} from '@mui/icons-material';
import { DrugLineItem, ExtractedInvoice } from '../types';
import { saveInvoiceToWorkspace, formatIQD } from '../services/googleWorkspace';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';

interface ExtractionReviewSheetProps {
  open: boolean;
  onClose: () => void;
  invoice: ExtractedInvoice | null;
  knownStores: string[];
  onInvoiceSaved: (storeName: string, rowsCount: number) => void;
  onAddNewStore: (newStoreName: string) => void;
}

export const ExtractionReviewSheet: React.FC<ExtractionReviewSheetProps> = ({
  open,
  onClose,
  invoice,
  knownStores,
  onInvoiceSaved,
  onAddNewStore,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Editable state
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [lineItems, setLineItems] = useState<DrugLineItem[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // New store dialog
  const [addStoreDialogOpen, setAddStoreDialogOpen] = useState(false);
  const [newStoreInput, setNewStoreInput] = useState('');

  // Saving state & error handling
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or update data when invoice changes
  useEffect(() => {
    if (invoice) {
      setSelectedStore(invoice.store_name || '');
      setInvoiceDate(invoice.invoice_date || new Date().toISOString().split('T')[0]);
      setInvoiceNumber(invoice.invoice_number || '');
      setLineItems(
        (invoice.line_items || []).map((item) => ({
          ...item,
          id: item.id || 'item_' + Math.random().toString(36).substring(2, 8),
        }))
      );
      setErrorMessage(null);
    }
  }, [invoice]);

  if (!invoice) return null;

  const isStoreMatched = selectedStore && knownStores.includes(selectedStore);

  // Line item edits
  const handleItemChange = (id: string, field: keyof DrugLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          const qty = field === 'quantity' ? Number(value) || 0 : item.quantity;
          const price = field === 'unit_price' ? Number(value) || 0 : item.unit_price;
          updated.line_total = Number((qty * price).toFixed(2));
        }
        return updated;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddLineItem = () => {
    const newItem: DrugLineItem = {
      id: 'item_' + Date.now(),
      drug_name: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((acc, it) => acc + (Number(it.line_total) || 0), 0);
  };

  const handleSaveToSheet = async () => {
    if (!selectedStore.trim()) {
      setErrorMessage('Please select or specify a distributor / store name before saving.');
      return;
    }

    if (lineItems.length === 0) {
      setErrorMessage('Please add at least one drug line item.');
      return;
    }

    // Check for empty drug names
    const hasEmptyName = lineItems.some((it) => !it.drug_name.trim());
    if (hasEmptyName) {
      setErrorMessage('Some line items are missing drug names. Please fill or remove them.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const invoicePayload: ExtractedInvoice = {
      ...invoice,
      store_name: selectedStore.trim(),
      invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
      invoice_number: invoiceNumber.trim(),
      line_items: lineItems,
      total_amount: calculateGrandTotal(),
    };

    const result = await saveInvoiceToWorkspace(invoicePayload, selectedStore.trim());

    setSaving(false);
    if (result.success) {
      onInvoiceSaved(selectedStore.trim(), result.rowsAdded);
      onClose();
    } else {
      setErrorMessage(result.error || 'Failed to save invoice. Check connection and retry.');
    }
  };

  const handleCreateNewStore = () => {
    const trimmed = newStoreInput.trim();
    if (trimmed) {
      onAddNewStore(trimmed);
      setSelectedStore(trimmed);
      setNewStoreInput('');
      setAddStoreDialogOpen(false);
    }
  };

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#ffffff',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        {/* Drag handle / top bar */}
        <Box sx={{ width: 48, height: 5, bgcolor: '#cbd5e1', borderRadius: 3, mx: 'auto', mt: 1.5, mb: 1 }} />

        {/* Header */}
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2.5,
                bgcolor: '#f0fdfa',
                color: '#0f766e',
                display: 'flex',
              }}
            >
              <ReceiptIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                Review Extracted Invoice
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Verify items before logging to Google Sheet & Drive
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {invoice.photoDataUrl && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={() => setIsPhotoModalOpen(true)}
                sx={{
                  color: '#0f766e',
                  borderColor: '#ccfbf1',
                  bgcolor: '#f0fdfa',
                  '&:hover': { bgcolor: '#ccfbf1' },
                }}
              >
                View Photo
              </Button>
            )}
            <IconButton onClick={onClose} size="small" sx={{ color: '#64748b' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content Scroll Area */}
        <Box sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto', flex: 1 }}>
          {/* Error Banner with Retry */}
          {errorMessage && (
            <Alert
              severity="error"
              sx={{ mb: 2.5, borderRadius: 3 }}
              action={
                <Button color="inherit" size="small" startIcon={<RetryIcon />} onClick={handleSaveToSheet}>
                  Retry
                </Button>
              }
            >
              {errorMessage}
            </Alert>
          )}

          {/* Store & Date Metadata Grid */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              bgcolor: '#f8fafc',
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5, display: 'block' }}>
              Invoice Metadata
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.5fr 1fr 1fr' }, gap: 2 }}>
              {/* Store Selector */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                    Distributor / Store Name:
                  </Typography>
                  {!isStoreMatched && (
                    <Chip
                      icon={<UncertainIcon sx={{ fontSize: '13px !important' }} />}
                      label="Confirm Store"
                      size="small"
                      color="warning"
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                    />
                  )}
                </Box>

                <FormControl fullWidth size="small">
                  <Select
                    value={selectedStore}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setAddStoreDialogOpen(true);
                      } else {
                        setSelectedStore(e.target.value);
                      }
                    }}
                    displayEmpty
                    sx={{
                      bgcolor: '#ffffff',
                      borderColor: !isStoreMatched ? '#f59e0b' : undefined,
                    }}
                  >
                    <MenuItem value="" disabled>
                      <em>Select or match supplier...</em>
                    </MenuItem>
                    {knownStores.map((store) => (
                      <MenuItem key={store} value={store}>
                        {store}
                      </MenuItem>
                    ))}
                    {selectedStore && !knownStores.includes(selectedStore) && (
                      <MenuItem value={selectedStore}>
                        {selectedStore} (Extracted)
                      </MenuItem>
                    )}
                    <MenuItem value="__NEW__" sx={{ color: '#0f766e', fontWeight: 700, borderTop: '1px dashed #cbd5e1' }}>
                      <AddStoreIcon fontSize="small" sx={{ mr: 1 }} /> + Add New Store...
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Invoice Date */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', display: 'block', mb: 0.5 }}>
                  Invoice Date:
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  sx={{ bgcolor: '#ffffff' }}
                />
              </Box>

              {/* Invoice Number */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', display: 'block', mb: 0.5 }}>
                  Invoice Ref / Bill #:
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g. INV-9842"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  sx={{ bgcolor: '#ffffff' }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Line items Section */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Extracted Medicine Line Items ({lineItems.length})
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Tap any cell to edit drug name, quantity, or price
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddLineItem}
              sx={{
                borderColor: '#0f766e',
                color: '#0f766e',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              Add Drug Row
            </Button>
          </Box>

          {/* Table */}
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              overflowX: 'auto',
              mb: 2.5,
            }}
          >
            <Table size="small" sx={{ minWidth: { xs: 480, sm: 600 } }}>
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#334155', width: '40%' }}>
                    Drug / Medicine Name (Arabic/English)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#334155', width: '15%' }}>
                    Quantity
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#334155', width: '18%' }}>
                    Unit Price (iqd)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#334155', width: '22%' }}>
                    Line Total
                  </TableCell>
                  <TableCell align="center" sx={{ width: '9%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lineItems.map((item, index) => (
                  <TableRow key={item.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#fafafa' } }}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Drug name & strength..."
                        value={item.drug_name}
                        onChange={(e) => handleItemChange(item.id, 'drug_name', e.target.value)}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: '0.85rem',
                            py: 0.8,
                            fontFamily: 'Cairo, Plus Jakarta Sans, sans-serif',
                            direction: /[\u0600-\u06FF]/.test(item.drug_name) ? 'rtl' : 'ltr',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        slotProps={{
                          htmlInput: { min: 1, style: { textAlign: 'right', fontSize: '0.85rem', padding: '6.4px' } },
                        }}
                        sx={{ width: '80px' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)}
                        slotProps={{
                          htmlInput: { step: '1', min: 0, style: { textAlign: 'right', fontSize: '0.85rem', padding: '6.4px' } },
                        }}
                        sx={{ width: '95px' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        className="font-mono-num"
                        sx={{ fontWeight: 700, color: '#0f766e', fontSize: '0.88rem' }}
                      >
                        {formatIQD(item.line_total)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Delete row">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteItem(item.id)}
                          sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                      No line items extracted. Click "+ Add Drug Row" above to enter manually.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Grand Total Summary Card */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: '#f0fdfa',
              border: '1px solid #99f6e4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700, textTransform: 'uppercase' }}>
                Invoice Total Amount
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {lineItems.length} lines ready for Google Sheet sync
              </Typography>
            </Box>
            <Typography variant="h5" className="font-mono-num" sx={{ fontWeight: 800, color: '#0f766e' }}>
              {formatIQD(calculateGrandTotal())}
            </Typography>
          </Paper>
        </Box>

        {/* Bottom Actions Bar */}
        <Box
          sx={{
            p: 2,
            px: { xs: 2, sm: 3 },
            borderTop: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={saving}
            sx={{ color: '#64748b', borderColor: '#cbd5e1', flex: 1 }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveToSheet}
            disabled={saving || lineItems.length === 0}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            sx={{ flex: 2, py: 1.2, fontSize: '0.95rem' }}
          >
            {saving ? 'Syncing to Google Sheets...' : 'Confirm & Save to Sheet'}
          </Button>
        </Box>
      </Drawer>

      {/* Add New Store Dialog */}
      <Dialog
        open={addStoreDialogOpen}
        onClose={() => setAddStoreDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Drug Distributor / Store</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the exact pharmacy store or distributor name (supports Arabic & English).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Store / Distributor Name"
            placeholder="e.g. Al-Nour Drug Store - مستودع النور"
            value={newStoreInput}
            onChange={(e) => setNewStoreInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateNewStore();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddStoreDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleCreateNewStore} variant="contained" disabled={!newStoreInput.trim()}>
            Add Store
          </Button>
        </DialogActions>
      </Dialog>

      {/* High-res Photo Lightbox Modal */}
      <PhotoPreviewModal
        open={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        photoUrl={invoice.photoDataUrl}
        storeName={selectedStore || invoice.store_name || undefined}
        date={invoiceDate}
        invoiceNumber={invoiceNumber}
      />
    </>
  );
};
