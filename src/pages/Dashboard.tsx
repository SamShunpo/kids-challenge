import { useEffect, useState } from 'react';
import { Typography, Box, Tabs, Tab, CircularProgress } from '@mui/material';
import { supabase } from '../supabaseClient';
import WeeklyTracker from '../components/WeeklyTracker';

interface Child {
    id: string;
    name: string;
}

interface Objective {
    id: string;
    title: string;
    child_id?: string | null;
}

export default function Dashboard() {
    const [children, setChildren] = useState<Child[]>([]);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabIndex, setTabIndex] = useState(0);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [childRes, objRes] = await Promise.all([
                supabase.from('children').select('id, name').order('created_at'),
                supabase.from('objectives').select('id, title, child_id').order('created_at')
            ]);

            if (childRes.data) setChildren(childRes.data);
            if (objRes.data) setObjectives(objRes.data);
        } catch (error) {
            console.error('Error init dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
        </Box>
    );

    if (children.length === 0) return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
                No children found.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
                Go to Settings to add children and objectives.
            </Typography>
        </Box>
    );

    // Filter objectives for the selected child
    const currentChild = children[tabIndex];
    const filteredObjectives = objectives.filter(obj =>
        !obj.child_id || obj.child_id === currentChild.id
    );

    return (
        <Box sx={{ pb: 8 }}>
            <Typography variant="h5" sx={{ px: 2, pt: 2, fontWeight: 'bold' }}>
                Dashboard
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                    {children.map((child) => (
                        <Tab key={child.id} label={child.name} />
                    ))}
                </Tabs>
            </Box>

            <Box sx={{ px: 1 }}>
                {currentChild && (
                    <WeeklyTracker
                        key={currentChild.id}
                        childId={currentChild.id}
                        objectives={filteredObjectives}
                    />
                )}
            </Box>
        </Box>
    );
}
