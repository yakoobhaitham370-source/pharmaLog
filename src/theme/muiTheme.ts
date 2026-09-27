import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f766e', // Deep Teal
      light: '#14b8a6',
      dark: '#115e59',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0284c7', // Sky Blue
      light: '#38bdf8',
      dark: '#0369a1',
      contrastText: '#ffffff',
    },
    success: {
      main: '#16a34a',
      light: '#4ade80',
      dark: '#15803d',
    },
    warning: {
      main: '#d97706',
      light: '#fbbf24',
      dark: '#b45309',
    },
    error: {
      main: '#dc2626',
      light: '#f87171',
      dark: '#b91c1c',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: ['Plus Jakarta Sans', 'Cairo', 'system-ui', 'sans-serif'].join(','),
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(15, 118, 110, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 16,
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 8px 24px rgba(15, 118, 110, 0.35)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
        },
      },
    },
  },
});
