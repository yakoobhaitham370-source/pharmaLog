import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Storefront as StoreIcon,
  CalendarMonth as DateIcon,
  BrokenImage as BrokenImageIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import { getDirectImageUrl, getStoredInvoicePhoto } from '../services/photoStorage';

interface PhotoPreviewModalProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string;
  title?: string;
  storeName?: string;
  date?: string;
  invoiceNumber?: string;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  open,
  onClose,
  photoUrl,
  title = 'Original Invoice Photo',
  storeName,
  date,
  invoiceNumber,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!photoUrl) {
      setResolvedSrc('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);

    // 1. Check if direct base64 or blob
    if (photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')) {
      setResolvedSrc(photoUrl);
      setLoading(false);
      return;
    }

    // 2. Try IndexedDB with invoiceNumber or photoUrl key
    const tryLoad = async () => {
      if (invoiceNumber) {
        const stored = await getStoredInvoicePhoto(invoiceNumber);
        if (stored && isMounted) {
          setResolvedSrc(stored);
          setLoading(false);
          return;
        }
      }

      // Check direct converted Drive image URL
      const direct = getDirectImageUrl(photoUrl);
      if (isMounted) {
        setResolvedSrc(direct);
        setLoading(false);
      }
    };

    tryLoad();

    return () => {
      isMounted = false;
    };
  }, [photoUrl, invoiceNumber]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: { xs: 3, sm: 4 },
            bgcolor: '#0f172a',
            color: '#ffffff',
            overflow: 'hidden',
            m: { xs: 1.5, sm: 3 },
            maxHeight: '92vh',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#ffffff' }}>
            {title}
          </Typography>
          {(storeName || date) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              {storeName && (
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StoreIcon sx={{ fontSize: 13 }} /> {storeName}
                </Typography>
              )}
              {date && (
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <DateIcon sx={{ fontSize: 13 }} /> {date}
                </Typography>
              )}
              {invoiceNumber && (
                <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600 }}>
                  #{invoiceNumber}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#ffffff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Image Content Body */}
      <DialogContent
        sx={{
          p: 0,
          bgcolor: '#020617',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 380,
          position: 'relative',
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 6 }}>
            <CircularProgress size={36} sx={{ color: '#38bdf8' }} />
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Loading invoice image...
            </Typography>
          </Box>
        )}

        {hasError ? (
          <Box sx={{ textAlign: 'center', p: 4, maxWidth: 360 }}>
            <BrokenImageIcon sx={{ fontSize: 48, color: '#64748b', mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 600, mb: 1 }}>
              Image archived securely in Google Drive
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>
              To view this high-resolution receipt, open directly in your connected Google Drive folder.
            </Typography>
            {photoUrl && (
              <Button
                variant="contained"
                size="small"
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' }, fontWeight: 700 }}
              >
                Open in Google Drive
              </Button>
            )}
          </Box>
        ) : (
          resolvedSrc && (
            <img
              src={resolvedSrc}
              alt="Original Pharmacy Invoice"
              onLoad={() => setLoading(false)}
              onError={() => {
                // If direct lh3 link fails, fallback
                if (!resolvedSrc.startsWith('data:')) {
                  setHasError(true);
                }
              }}
              style={{ display: loading ? 'none' : 'block' }}
              className="max-h-[72vh] w-auto max-w-full object-contain mx-auto transition-transform duration-200"
            />
          )
        )}
      </DialogContent>

      {/* Footer Actions */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#0f172a' }}>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Archived in Google Drive & Local Storage
        </Typography>
        {photoUrl && photoUrl.startsWith('http') && (
          <Button
            size="small"
            variant="outlined"
            href={photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon fontSize="small" />}
            sx={{
              color: '#38bdf8',
              borderColor: '#0369a1',
              '&:hover': { borderColor: '#38bdf8' },
              fontWeight: 600,
            }}
          >
            Open in Google Drive
          </Button>
        )}
      </Box>
    </Dialog>
  );
};
