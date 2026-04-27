'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: '#4ea1ff' },
    secondary: { main: '#7ad7c0' },
    error: { main: '#ff6b6b' },
    warning: { main: '#ffb648' },
    success: { main: '#4ade80' },
    info: { main: '#4ea1ff' },
    background: {
      default: '#0b1220',
      paper: '#121a2b',
    },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary: '#e6edf7',
      secondary: '#9aa9bf',
    },
  },
  typography: {
    fontFamily: 'var(--font-roboto), system-ui, sans-serif',
    h6: { fontWeight: 600, letterSpacing: 0.2 },
    button: { textTransform: 'none', fontWeight: 600 },
    body2: { letterSpacing: 0.1 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0e1626',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0e1626',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

export default theme;
