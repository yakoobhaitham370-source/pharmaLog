import React from 'react';
import { Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Search as SearchIcon,
  Storefront as StoreIcon,
  DynamicFeed as BatchIcon,
} from '@mui/icons-material';

interface BottomNavBarProps {
  currentTab: 'capture' | 'search' | 'stores' | 'bulk';
  onTabChange: (tab: 'capture' | 'search' | 'stores' | 'bulk') => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentTab, onTabChange }) => {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        pb: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <BottomNavigation
        showLabels
        value={currentTab}
        onChange={(_event, newValue) => {
          onTabChange(newValue);
        }}
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            color: '#64748b',
            '&.Mui-selected': {
              color: '#0f766e',
              fontWeight: 700,
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.75rem',
              mt: 0.3,
            },
          },
        }}
      >
        <BottomNavigationAction
          label="Capture"
          value="capture"
          icon={<CameraIcon sx={{ fontSize: 24 }} />}
        />
        <BottomNavigationAction
          label="Search Drug"
          value="search"
          icon={<SearchIcon sx={{ fontSize: 24 }} />}
        />
        <BottomNavigationAction
          label="Stores"
          value="stores"
          icon={<StoreIcon sx={{ fontSize: 24 }} />}
        />
        <BottomNavigationAction
          label="Bulk Import"
          value="bulk"
          icon={<BatchIcon sx={{ fontSize: 24 }} />}
        />
      </BottomNavigation>
    </Paper>
  );
};
