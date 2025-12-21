import React from 'react';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Container } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [value, setValue] = React.useState(0);

    React.useEffect(() => {
        if (location.pathname === '/settings') {
            setValue(1);
        } else {
            setValue(0);
        }
    }, [location]);

    return (
        <Box sx={{ pb: 7 }}>
            <Container maxWidth="sm" sx={{ pt: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </Container>
            <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
                <BottomNavigation
                    showLabels
                    value={value}
                    onChange={(_event, newValue) => {
                        setValue(newValue);
                        if (newValue === 0) navigate('/');
                        if (newValue === 1) navigate('/settings');
                    }}
                >
                    <BottomNavigationAction label="Home" icon={<HomeIcon />} />
                    <BottomNavigationAction label="Settings" icon={<SettingsIcon />} />
                </BottomNavigation>
            </Paper>
        </Box>
    );
}
