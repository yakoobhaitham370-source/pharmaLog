import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Stack,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  DynamicFeed as BatchIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Storefront as StoreIcon,
  AddPhotoAlternate as AddPhotosIcon,
  AutoAwesome as SparklesIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { BatchInvoiceItem, ExtractedInvoice, MasterInvoiceRow } from '../types';
import { extractInvoiceFromImage, fileToBase64 } from '../services/geminiExtraction';
import { saveInvoiceToWorkspace, formatIQD } from '../services/googleWorkspace';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';

interface BulkImportViewProps {
  knownStores: string[];
  onBatchSaved: (count: number) => void;
}

export const BulkImportView: React.FC<BulkImportViewProps> = ({ knownStores, onBatchSaved }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchItems, setBatchItems] = useState<BatchInvoiceItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: BatchInvoiceItem[] = files.map((file, idx) => ({
      id: 'batch_' + Date.now() + '_' + idx,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));

    setBatchItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleStartBatchExtraction = async () => {
    const pending = batchItems.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pending.length === 0) return;

    setProcessing(true);
    setErrorBanner(null);
    setBatchProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      setBatchProgress({ current: i + 1, total: pending.length });

      setBatchItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'extracting' } : it))
      );

      try {
        const base64 = await fileToBase64(item.file);
        const res = await extractInvoiceFromImage(base64, item.file.type || 'image/jpeg', knownStores);

        if (res.success && res.data) {
          setBatchItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'extracted', extractedData: res.data }
                : it
            )
          );
        } else {
          setBatchItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'error', errorMessage: res.error || 'Failed extraction' }
                : it
            )
          );
        }
      } catch (err: any) {
        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: 'error', errorMessage: err.message || 'Error processing file' }
              : it
          )
        );
      }
    }

    setProcessing(false);
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveAllBatch = async () => {
    const readyItems = batchItems.filter((it) => it.status === 'extracted' && it.extractedData);
    if (readyItems.length === 0) return;

    setSavingBatch(true);
    setErrorBanner(null);

    let savedCount = 0;
    for (const item of readyItems) {
      if (item.extractedData) {
        const res = await saveInvoiceToWorkspace(item.extractedData);
        if (res.success) {
          savedCount++;
          setBatchItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, status: 'saved' } : it))
          );
        }
      }
    }

    setSavingBatch(false);
    onBatchSaved(savedCount);
  };

  // Aggregated line items from all extracted invoices
  const allExtractedLines = batchItems
    .filter((it) => it.status === 'extracted' && it.extractedData)
    .flatMap((it) =>
      (it.extractedData?.line_items || []).map((line) => ({
        ...line,
        store: it.extractedData?.store_name || 'Unassigned Store',
        date: it.extractedData?.invoice_date || 'Today',
        batchId: it.id,
      }))
    );

  const totalExtractedSum = allExtractedLines.reduce((acc, it) => acc + (Number(it.line_total) || 0), 0);

  return (
    <Box sx={{ pb: 12, px: { xs: 2, sm: 3 }, pt: 2, maxWidth: 640, mx: 'auto' }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFilesChosen}
      />

      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
          Bulk Invoice Upload
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          Upload multiple supplier invoice photos for automated batch logging
        </Typography>
      </Box>

      {/* Upload Drop/Select Area */}
      <Paper
        elevation={0}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          p: 3.5,
          borderRadius: 3.5,
          border: '2px dashed #0f766e',
          bgcolor: '#f0fdfa',
          textAlign: 'center',
          cursor: 'pointer',
          mb: 3,
          transition: 'all 0.2s',
          '&:hover': { bgcolor: '#ccfbf1' },
        }}
      >
        <AddPhotosIcon sx={{ fontSize: 44, color: '#0f766e', mb: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f766e' }}>
          Tap to Select Multiple Invoices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select photos from your device library or files
        </Typography>
      </Paper>

      {/* Action Bar */}
      {batchItems.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Selected Invoices ({batchItems.length})
            </Typography>
            <Button
              size="small"
              color="error"
              onClick={() => setBatchItems([])}
              disabled={processing || savingBatch}
            >
              Clear All
            </Button>
          </Box>

          {/* Progress Bar */}
          {processing && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#0f766e' }}>
                  Processing invoice {batchProgress.current} of {batchProgress.total}...
                </Typography>
              </Box>
              <LinearProgress color="primary" sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              disabled={processing || savingBatch || !batchItems.some((i) => i.status === 'pending' || i.status === 'error')}
              onClick={handleStartBatchExtraction}
              startIcon={<SparklesIcon />}
              sx={{ flex: 1, fontWeight: 700 }}
            >
              {processing ? 'Extracting with Gemini...' : 'Run Batch OCR'}
            </Button>

            <Button
              variant="contained"
              color="success"
              disabled={processing || savingBatch || allExtractedLines.length === 0}
              onClick={handleSaveAllBatch}
              startIcon={<SuccessIcon />}
              sx={{ flex: 1, fontWeight: 700 }}
            >
              {savingBatch ? 'Saving...' : `Save All to Sheet (${allExtractedLines.length})`}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Selected Items List */}
      {batchItems.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Stack spacing={1.5}>
            {batchItems.map((item, index) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: '#ffffff',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <img
                    src={item.previewUrl}
                    alt="Invoice thumbnail"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer"
                    onClick={() => setPreviewPhotoUrl(item.previewUrl)}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                      Invoice #{index + 1}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {item.extractedData
                        ? `${item.extractedData.store_name || 'Unassigned'} • ${item.extractedData.line_items.length} lines`
                        : item.file.name}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {item.status === 'pending' && <Chip label="Pending" size="small" />}
                  {item.status === 'extracting' && <Chip label="Extracting..." color="info" size="small" />}
                  {item.status === 'extracted' && <Chip label="Ready" color="success" size="small" />}
                  {item.status === 'saved' && <Chip label="Saved in Sheet" color="primary" size="small" />}
                  {item.status === 'error' && <Chip label="Error" color="error" size="small" />}

                  <IconButton size="small" onClick={() => handleRemoveBatchItem(item.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Batch Summary Consolidated Table */}
      {allExtractedLines.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Consolidated Extracted Lines ({allExtractedLines.length})
            </Typography>
            <Typography variant="subtitle2" className="font-mono-num" sx={{ fontWeight: 800, color: '#0f766e' }}>
              Sum: {formatIQD(totalExtractedSum)}
            </Typography>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Drug Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total (iqd)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allExtractedLines.map((line, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#475569' }}>{line.store}</TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Cairo, sans-serif' }}>
                      {line.drug_name}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.82rem' }}>{line.quantity}</TableCell>
                    <TableCell align="right" className="font-mono-num" sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f766e' }}>
                      {formatIQD(line.line_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Photo Preview Lightbox */}
      {previewPhotoUrl && (
        <PhotoPreviewModal
          open={Boolean(previewPhotoUrl)}
          onClose={() => setPreviewPhotoUrl(null)}
          photoUrl={previewPhotoUrl}
        />
      )}
    </Box>
  );
};
