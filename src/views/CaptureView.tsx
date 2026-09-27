import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  LinearProgress,
  Stack,
  Card,
  CardActionArea,
  CardContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  Collections as GalleryIcon,
  AutoAwesome as SparklesIcon,
  Storefront as StoreIcon,
  History as HistoryIcon,
  Bolt as QuickIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircleOutlined as CheckIcon,
  Tune as TuneIcon,
  TableChart as SheetIcon,
  FolderOpen as DriveIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { ExtractedInvoice, MasterInvoiceRow } from '../types';
import { extractInvoiceFromImage, fileToBase64, generateSampleInvoicePhoto } from '../services/geminiExtraction';
import { getStoredWorkspaceAuth, getSpreadsheetUrl, getDriveFolderUrl, formatIQD } from '../services/googleWorkspace';
import { getCurrentUser, googleSignIn } from '../services/firebaseAuth';

interface CaptureViewProps {
  knownStores: string[];
  recentRows: MasterInvoiceRow[];
  onInvoiceExtracted: (invoice: ExtractedInvoice) => void;
  onNavigateToSearch: () => void;
  onNavigateToStores: () => void;
  onNavigateToBulk: () => void;
}

export const CaptureView: React.FC<CaptureViewProps> = ({
  knownStores,
  recentRows,
  onInvoiceExtracted,
  onNavigateToSearch,
  onNavigateToStores,
  onNavigateToBulk,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processImage = async (base64: string, filename?: string) => {
    setLoading(true);
    setErrorMessage(null);
    setLoadingStep('Uploading invoice photo...');

    try {
      setTimeout(() => setLoadingStep('Analyzing image with Gemini AI...'), 600);
      setTimeout(() => setLoadingStep('Reading mixed Arabic & English line items...'), 1400);

      const result = await extractInvoiceFromImage(base64, 'image/jpeg', knownStores);

      if (result.success && result.data) {
        result.data.photoFileName = filename || 'captured_invoice.jpg';
        onInvoiceExtracted(result.data);
      } else {
        setErrorMessage(result.error || 'Failed to extract invoice data. Please try again with clear lighting.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Extraction error occurred.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      await processImage(base64, file.name);
    } catch (err: any) {
      setErrorMessage('Could not read photo file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleTestWithSample = (sampleStore?: string) => {
    const storeToUse = sampleStore || knownStores[0] || 'Al-Hikma Pharma - الحكمة';
    const { dataUrl } = generateSampleInvoicePhoto(storeToUse);
    processImage(dataUrl, `sample_${storeToUse.replace(/\s+/g, '_')}.jpg`);
  };

  const currentUser = getCurrentUser();
  const auth = getStoredWorkspaceAuth();

  return (
    <Box sx={{ pb: 10, px: { xs: 2, sm: 3 }, pt: 2, maxWidth: 640, mx: 'auto' }}>
      {/* Google Sheets & Drive Account Status Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 3,
          bgcolor: currentUser ? '#f0fdfa' : '#ffffff',
          border: '1px solid',
          borderColor: currentUser ? '#99f6e4' : '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box sx={{ p: 0.8, bgcolor: currentUser ? '#ccfbf1' : '#f1f5f9', borderRadius: 2, display: 'flex' }}>
            {currentUser ? <SheetIcon sx={{ color: '#0f766e', fontSize: 20 }} /> : <DriveIcon sx={{ color: '#64748b', fontSize: 20 }} />}
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: currentUser ? '#0f766e' : '#475569', display: 'block', lineHeight: 1.2 }}>
              {currentUser ? `Connected: ${currentUser.email}` : 'Google Sheets & Drive'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
              {currentUser ? 'Invoices sync directly to your Drive & Sheet' : 'Sign in to create your Master Sheet in Drive'}
            </Typography>
          </Box>
        </Box>

        {currentUser ? (
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            <Button
              size="small"
              variant="outlined"
              href={getSpreadsheetUrl()}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
              sx={{ py: 0.4, px: 1, fontSize: '0.72rem', fontWeight: 600, borderRadius: 2 }}
            >
              Sheets
            </Button>
            <Button
              size="small"
              variant="outlined"
              href={getDriveFolderUrl()}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
              sx={{ py: 0.4, px: 1, fontSize: '0.72rem', fontWeight: 600, borderRadius: 2 }}
            >
              Drive
            </Button>
          </Box>
        ) : (
          <Button
            size="small"
            variant="contained"
            onClick={async () => {
              try {
                await googleSignIn();
                window.location.reload();
              } catch (e) {
                console.error(e);
              }
            }}
            sx={{ py: 0.5, px: 1.5, fontSize: '0.75rem', fontWeight: 700, borderRadius: 2 }}
          >
            Connect
          </Button>
        )}
      </Paper>

      {/* Hidden file inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Main Hero Card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          background: 'linear-gradient(145deg, #0f766e 0%, #115e59 100%)',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          mb: 3,
          boxShadow: '0 12px 30px rgba(15, 118, 110, 0.25)',
        }}
      >
        {/* Background decorative circles */}
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 70%)',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Chip
            icon={<SparklesIcon sx={{ fontSize: '15px !important', color: '#5eead4 !important' }} />}
            label="Gemini Multimodal OCR"
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              fontWeight: 600,
              mb: 2,
              backdropFilter: 'blur(8px)',
            }}
          />

          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.01em' }}>
            Log Supplier Invoice
          </Typography>
          <Typography variant="body2" sx={{ color: '#ccfbf1', mb: 3.5, maxWidth: 360, mx: 'auto', lineHeight: 1.5 }}>
            Snap a photo of any distributor paper invoice. Gemini reads all drug lines in English & Arabic for instant review.
          </Typography>

          {/* Prominent Capture Button (Core requirement 1) */}
          <Button
            variant="contained"
            size="large"
            disabled={loading}
            onClick={() => cameraInputRef.current?.click()}
            startIcon={<CameraIcon sx={{ fontSize: 28 }} />}
            sx={{
              width: '100%',
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 800,
              borderRadius: 3.5,
              bgcolor: '#ffffff',
              color: '#0f766e',
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
              '&:hover': {
                bgcolor: '#f0fdfa',
                color: '#115e59',
              },
            }}
          >
            {loading ? 'Processing...' : 'Photograph Paper Invoice'}
          </Button>

          {/* Secondary photo picker option */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              size="small"
              disabled={loading}
              onClick={() => galleryInputRef.current?.click()}
              startIcon={<GalleryIcon />}
              sx={{
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                opacity: 0.9,
                '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Choose from Photo Gallery
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Loading Progress State */}
      {loading && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: '1px solid #99f6e4',
            bgcolor: '#f0fdfa',
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1.5 }}>
            <SparklesIcon className="animate-spin text-teal-600" />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f766e' }}>
              {loadingStep || 'Analyzing invoice...'}
            </Typography>
          </Box>
          <LinearProgress
            color="primary"
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#ccfbf1',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: '#0f766e',
              },
            }}
          />
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
            Extracting store name, invoice date, medicine names, quantities, and prices...
          </Typography>
        </Paper>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 3,
            border: '1px solid #fecaca',
            bgcolor: '#fef2f2',
            color: '#991b1b',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {errorMessage}
          </Typography>
        </Paper>
      )}

      {/* Known Stores Quick Chips */}
      {knownStores.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon sx={{ fontSize: 18, color: '#0f766e' }} /> Known Distributors ({knownStores.length})
            </Typography>
            <Button
              size="small"
              onClick={onNavigateToStores}
              endIcon={<ArrowForwardIcon fontSize="small" />}
              sx={{ color: '#0f766e', fontWeight: 600, p: 0 }}
            >
              Manage
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {knownStores.map((store) => (
              <Chip
                key={store}
                label={store}
                size="small"
                sx={{
                  bgcolor: '#f1f5f9',
                  color: '#334155',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Logged Activity */}
      {recentRows.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18, color: '#64748b' }} /> Recently Logged Items
            </Typography>
            <Button
              size="small"
              onClick={onNavigateToSearch}
              endIcon={<ArrowForwardIcon fontSize="small" />}
              sx={{ color: '#0f766e', fontWeight: 600, p: 0 }}
            >
              Search All ({recentRows.length})
            </Button>
          </Box>

          <Stack spacing={1.5}>
            {recentRows.slice(0, 5).map((row) => (
              <Box
                key={row.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: '#f8fafc',
                }}
              >
                <Box sx={{ maxWidth: '70%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }} noWrap>
                    {row.drug_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {row.store} • {row.date} • Qty: {row.quantity}
                  </Typography>
                </Box>
                <Typography variant="body2" className="font-mono-num" sx={{ fontWeight: 700, color: '#0f766e' }}>
                  {formatIQD(row.line_total)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};
