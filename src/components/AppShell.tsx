'use client';

import * as React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Button,
  Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';
import RadioIcon from '@mui/icons-material/Radio';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { miiStore } from '@/lib/mii/store';

const drawerWidth = 248;
const AUTH_ENABLED = process.env.NEXT_PUBLIC_DEMO_AUTH_ENABLED === 'true';

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { href: '/demo', label: 'Guided Demo', icon: <SlideshowIcon fontSize="small" /> },
  { href: '/incidents', label: 'Incidents', icon: <LocalFireDepartmentIcon fontSize="small" /> },
  { href: '/transcripts', label: 'Transcripts', icon: <RecordVoiceOverIcon fontSize="small" /> },
  { href: '/audio', label: 'Audio Intake', icon: <GraphicEqIcon fontSize="small" /> },
  { href: '/units', label: 'Units', icon: <DirectionsCarIcon fontSize="small" /> },
  { href: '/codes', label: 'Codes', icon: <MenuBookIcon fontSize="small" /> },
  { href: '/audit', label: 'Audit Log', icon: <HistoryIcon fontSize="small" /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleReset = () => {
    if (window.confirm('Reset all demo data? This clears incidents, transcripts, and audit log.')) {
      miiStore.reset();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/demo-auth/logout', { method: 'POST' });
    } catch {
      // best-effort — clearing the cookie server-side is the source of truth
    }
    router.replace('/demo-login');
    router.refresh();
  };

  // The login screen renders standalone, without the dispatch console chrome.
  if (pathname === '/demo-login') {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <RadioIcon color="primary" />
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            MII_lite
          </Typography>
          <Chip
            size="small"
            label="LOCAL POC"
            color="primary"
            variant="outlined"
            sx={{ letterSpacing: 1 }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            size="small"
            label="SIMULATED DATA ONLY"
            color="warning"
            variant="outlined"
            sx={{ letterSpacing: 0.8, fontWeight: 700 }}
          />
          <Tooltip title="Clear all incidents, transcripts, units, and audit events">
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
            >
              Reset Demo Data
            </Button>
          </Tooltip>
          {AUTH_ENABLED && (
            <Tooltip title="Clear your demo session and return to the access screen">
              <Button
                size="small"
                color="inherit"
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                End Demo Session
              </Button>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
            Dispatch Sidecar
          </Typography>
        </Box>
        <Divider sx={{ mx: 2 }} />
        <List sx={{ px: 1 }}>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={active}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': { backgroundColor: 'rgba(78,161,255,0.12)' },
                  '&.Mui-selected:hover': { backgroundColor: 'rgba(78,161,255,0.18)' },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{ primary: { sx: { fontSize: 14, fontWeight: active ? 600 : 500 } } }}
                />
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Tenant: Sunny Isles Beach
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Transcript-first MII POC
          </Typography>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${drawerWidth}px)`, minWidth: 0 }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
