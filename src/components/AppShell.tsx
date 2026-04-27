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
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';
import RadioIcon from '@mui/icons-material/Radio';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const drawerWidth = 248;

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  {
    href: '/incidents',
    label: 'Active Incidents',
    icon: <LocalFireDepartmentIcon fontSize="small" />,
  },
  { href: '/units', label: 'Unit Management', icon: <DirectionsCarIcon fontSize="small" /> },
  {
    href: '/transcripts',
    label: 'Radio Transcripts',
    icon: <RecordVoiceOverIcon fontSize="small" />,
  },
  { href: '/codes', label: 'Code Dictionary', icon: <MenuBookIcon fontSize="small" /> },
  { href: '/audit', label: 'Audit Log', icon: <HistoryIcon fontSize="small" /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <RadioIcon color="primary" />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            MII Dispatch Sidecar
          </Typography>
          <Chip
            size="small"
            label="LIVE"
            color="success"
            variant="outlined"
            sx={{ letterSpacing: 1 }}
          />
          <Chip size="small" label="Sunny Isles 50" variant="outlined" />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 1.2 }}
          >
            Dispatcher
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
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(78,161,255,0.12)',
                  },
                  '&.Mui-selected:hover': {
                    backgroundColor: 'rgba(78,161,255,0.18)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: active ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: { fontSize: 14, fontWeight: active ? 600 : 500 },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Operator: D. Rivera
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Shift: 1500–2300
          </Typography>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${drawerWidth}px)`,
          minWidth: 0,
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
