import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  Chip,
  Stack,
  Button,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Image as ImageIcon,
  Storefront as StoreIcon,
  CalendarMonth as DateIcon,
  LocalPharmacy as DrugIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { MasterInvoiceRow } from '../types';
import { PhotoPreviewModal } from '../components/PhotoPreviewModal';
import { exportInvoicesToCSV, formatIQD } from '../services/googleWorkspace';

interface SearchViewProps {
  masterRows: MasterInvoiceRow[];
  knownStores: string[];
}

export const SearchView: React.FC<SearchViewProps> = ({ masterRows, knownStores }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    store: string;
    date: string;
    invoiceNum?: string;
  } | null>(null);

  // Filter line items based on search term (supports English & Arabic) and store
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return masterRows.filter((row) => {
      const matchStore =
        selectedStoreFilter === 'ALL' || row.store === selectedStoreFilter;

      if (!matchStore) return false;

      if (!term) return true;

      const drugMatch = (row.drug_name || '').toLowerCase().includes(term);
      const storeMatch = (row.store || '').toLowerCase().includes(term);
      const invMatch = (row.invoiceNumber || '').toLowerCase().includes(term);
      const dateMatch = (row.date || '').includes(term);

      return drugMatch || storeMatch || invMatch || dateMatch;
    });
  }, [masterRows, searchTerm, selectedStoreFilter]);

  // Aggregate statistics for filtered view
  const totalCost = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (Number(r.line_total) || 0), 0);
  }, [filteredRows]);

  const totalQuantity = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  }, [filteredRows]);

  return (
    <Box sx={{ pb: 12, px: { xs: 2, sm: 3 }, pt: 2, maxWidth: 640, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Master Drug Search
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Search across all stores from the "All Invoices" master sheet
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => exportInvoicesToCSV(filteredRows)}
          sx={{ borderRadius: 2, fontSize: '0.75rem', fontWeight: 600, color: '#0f766e', borderColor: '#99f6e4' }}
        >
          Export CSV
        </Button>
      </Box>

      {/* Search Input Box */}
      <Paper
        elevation={0}
        sx={{
          p: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          borderRadius: 3,
          border: '1.5px solid #0f766e',
          bgcolor: '#ffffff',
          mb: 2,
          boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
        }}
      >
        <IconButton sx={{ p: '8px', color: '#0f766e' }}>
          <SearchIcon />
        </IconButton>
        <TextField
          fullWidth
          variant="standard"
          placeholder="Type drug name (e.g. Panadol, بنادول, Augmentin)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              disableUnderline: true,
              sx: {
                fontSize: '0.95rem',
                fontFamily: 'Cairo, Plus Jakarta Sans, sans-serif',
              },
            },
          }}
        />
        {searchTerm && (
          <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: '#94a3b8', mr: 1 }}>
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Paper>

      {/* Store Filter Chips */}
      <Box sx={{ mb: 2.5, overflowX: 'auto', pb: 0.5 }} className="no-scrollbar">
        <Stack direction="row" spacing={1}>
          <Chip
            label="All Stores"
            size="small"
            clickable
            color={selectedStoreFilter === 'ALL' ? 'primary' : 'default'}
            variant={selectedStoreFilter === 'ALL' ? 'filled' : 'outlined'}
            onClick={() => setSelectedStoreFilter('ALL')}
            sx={{ fontWeight: 600 }}
          />
          {knownStores.map((store) => (
            <Chip
              key={store}
              label={store}
              size="small"
              clickable
              color={selectedStoreFilter === store ? 'primary' : 'default'}
              variant={selectedStoreFilter === store ? 'filled' : 'outlined'}
              onClick={() => setSelectedStoreFilter(store)}
              sx={{ fontWeight: 500, fontSize: '0.78rem' }}
            />
          ))}
        </Stack>
      </Box>

      {/* Summary Stat Banner */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: '#f8fafc',
          p: 1.5,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569' }}>
          Found <b>{filteredRows.length}</b> line items ({totalQuantity} total units)
        </Typography>
        <Typography variant="caption" className="font-mono-num" sx={{ fontWeight: 700, color: '#0f766e' }}>
          Total: {formatIQD(totalCost)}
        </Typography>
      </Box>

      {/* Results List */}
      <Stack spacing={2}>
        {filteredRows.map((row) => (
          <Paper
            key={row.id}
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
            {/* Top row: Store chip and Date */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
              <Chip
                icon={<StoreIcon sx={{ fontSize: '13px !important' }} />}
                label={row.store}
                size="small"
                sx={{
                  bgcolor: '#f0fdfa',
                  color: '#0f766e',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  maxWidth: '65%',
                }}
              />
              <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DateIcon sx={{ fontSize: 13 }} /> {row.date}
              </Typography>
            </Box>

            {/* Drug Name with Arabic support */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.3,
                mb: 1.5,
                fontFamily: 'Cairo, Plus Jakarta Sans, sans-serif',
                direction: /[\u0600-\u06FF]/.test(row.drug_name) ? 'rtl' : 'ltr',
              }}
            >
              {row.drug_name}
            </Typography>

            <Divider sx={{ my: 1, borderColor: '#f1f5f9' }} />

            {/* Quantity, Unit Price, Total & Invoice Photo Link Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                    QTY
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {row.quantity}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                    UNIT PRICE
                  </Typography>
                  <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                    {formatIQD(row.unit_price)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#0f766e', display: 'block', fontSize: '0.7rem', fontWeight: 700 }}>
                    TOTAL
                  </Typography>
                  <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 800, color: '#0f766e', fontSize: '0.85rem' }}>
                    {formatIQD(row.line_total)}
                  </Typography>
                </Box>
              </Box>

              {/* Photo Link Button */}
              {row.photoLink ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ImageIcon fontSize="small" />}
                  onClick={() =>
                    setPreviewPhoto({
                      url: row.photoLink,
                      store: row.store,
                      date: row.date,
                      invoiceNum: row.invoiceNumber,
                    })
                  }
                  sx={{
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderColor: '#cbd5e1',
                    color: '#0f766e',
                    '&:hover': { bgcolor: '#f0fdfa', borderColor: '#0f766e' },
                  }}
                >
                  Invoice Photo
                </Button>
              ) : (
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  No photo
                </Typography>
              )}
            </Box>
          </Paper>
        ))}

        {filteredRows.length === 0 && (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <DrugIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#475569' }}>
              No matching drug line items
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Try searching with another drug brand or generic name in Arabic or English.
            </Typography>
          </Paper>
        )}
      </Stack>

      {/* Photo Preview Lightbox */}
      {previewPhoto && (
        <PhotoPreviewModal
          open={!!previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          photoUrl={previewPhoto.url}
          storeName={previewPhoto.store}
          date={previewPhoto.date}
          invoiceNumber={previewPhoto.invoiceNum}
        />
      )}
    </Box>
  );
};
