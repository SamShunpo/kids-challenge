import { useEffect, useState } from 'react';
import { Typography, Box, Tabs, Tab, CircularProgress, Paper, Divider, TextField, Button, List, ListItem, ListItemText, Chip } from '@mui/material';
import { startOfWeek, parseISO } from 'date-fns';
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
    deleted_at?: string | null;
    created_at?: string;
}

export default function Dashboard() {
    const [children, setChildren] = useState<Child[]>([]);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabIndex, setTabIndex] = useState(0);

    const [exclusions, setExclusions] = useState<any[]>([]);

    const [transactions, setTransactions] = useState<any[]>([]);
    const [allLogs, setAllLogs] = useState<any[]>([]);
    const [spendAmount, setSpendAmount] = useState('');
    const [spendReason, setSpendReason] = useState('');
    const [pointsProcessing, setPointsProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (children.length > 0) {
            fetchChildHistory(children[tabIndex].id);
        }
    }, [tabIndex, children]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [childRes, objRes] = await Promise.all([
                supabase.from('children').select('id, name').order('created_at'),
                supabase.from('objectives').select('id, title, child_id, deleted_at, created_at').order('created_at')
            ]);

            if (childRes.data) setChildren(childRes.data);
            if (objRes.data) setObjectives(objRes.data);
        } catch (error) {
            console.error('Error init dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChildHistory = async (childId: string) => {
        const [logsRes, txRes, excRes] = await Promise.all([
            supabase.from('daily_logs').select('*').eq('child_id', childId),
            supabase.from('point_transactions').select('*').eq('child_id', childId).order('created_at', { ascending: false }),
            supabase.from('objective_exclusions').select('*')
        ]);

        if (logsRes.data) setAllLogs(logsRes.data);
        if (txRes.data) setTransactions(txRes.data || []);
        if (excRes.data) setExclusions(excRes.data || []);
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    // --- Points Calculation ---
    const calculatePoints = () => {
        if (!currentChild) return 0;

        let totalScore = 0;

        // 1. Group logs by week
        const weeks: Record<string, typeof allLogs> = {};
        allLogs.forEach(log => {
            const date = parseISO(log.date);
            const weekStart = startOfWeek(date, { weekStartsOn: 1 }).toISOString();
            if (!weeks[weekStart]) weeks[weekStart] = [];
            weeks[weekStart].push(log);
        });

        // 2. Calculate score per week
        Object.keys(weeks).forEach(weekStartIso => {
            const weekStart = parseISO(weekStartIso);
            const weekLogs = weeks[weekStartIso];

            // Determine active objectives for THIS week
            const weekActiveObjectives = filteredObjectives.filter(obj => { // Note: filteredObjectives is global for child, but we need time-sensitivity
                // We re-filter from ALL objectives for this child to be safe, but filteredObjectives is already child-filtered.
                // Just need time check.
                if (!obj.deleted_at) return true;
                return parseISO(obj.deleted_at) > weekStart;
            });

            if (weekActiveObjectives.length === 0) return;

            let perfectObjectives = 0;
            let weekScore = 0;

            weekActiveObjectives.forEach(obj => {
                const completedCount = weekLogs.filter(l => l.objective_id === obj.id && l.is_completed).length;
                if (completedCount === 7) {
                    weekScore += 1;
                    perfectObjectives++;
                }
            });

            const isPerfect = perfectObjectives === weekActiveObjectives.length;
            if (isPerfect) {
                weekScore = perfectObjectives * 2;
            }
            totalScore += weekScore;
        });

        // 3. Add transactions
        const txSum = transactions.reduce((sum, t) => sum + t.amount, 0);
        return totalScore + txSum;
    };

    const handleSpendPoints = async () => {
        if (!currentChild || !spendAmount || !spendReason) return;
        const amount = parseInt(spendAmount);
        if (isNaN(amount) || amount <= 0) return;

        setPointsProcessing(true);
        try {
            const { data, error } = await supabase.from('point_transactions').insert({
                child_id: currentChild.id,
                amount: -amount,
                description: spendReason
            }).select();

            if (error) throw error;
            if (data) {
                setTransactions([data[0], ...transactions]);
                setSpendAmount('');
                setSpendReason('');
            }
        } catch (err) {
            console.error(err);
            alert("Erreur transaction");
        } finally {
            setPointsProcessing(false);
        }
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

            <Box sx={{ px: 2, mb: 3 }}>
                {currentChild && (
                    <Paper sx={{ p: 2, bgcolor: 'primary.main', color: 'white', mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="caption" sx={{ opacity: 0.8 }}>Solde de points</Typography>
                                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{calculatePoints()}</Typography>
                            </Box>
                            <Button
                                variant="contained"
                                color="secondary"
                                size="small"
                                onClick={() => {
                                    const el = document.getElementById('spend-section');
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                Utiliser
                            </Button>
                        </Box>
                    </Paper>
                )}
            </Box>

            <Box sx={{ px: 1 }}>
                {currentChild && (
                    <>
                        <WeeklyTracker
                            key={currentChild.id}
                            childId={currentChild.id}
                            objectives={filteredObjectives}
                            exclusions={exclusions}
                            onUpdate={() => fetchChildHistory(currentChild.id)}
                        />

                        <Divider sx={{ my: 4 }} />

                        <Box id="spend-section" sx={{ px: 1, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>Utiliser des points</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                <TextField
                                    label="Combien ?"
                                    type="number"
                                    size="small"
                                    value={spendAmount}
                                    onChange={e => setSpendAmount(e.target.value)}
                                    sx={{ width: 100 }}
                                />
                                <TextField
                                    label="Pour quoi ?"
                                    size="small"
                                    fullWidth
                                    value={spendReason}
                                    onChange={e => setSpendReason(e.target.value)}
                                />
                                <Button
                                    variant="contained"
                                    onClick={handleSpendPoints}
                                    disabled={pointsProcessing}
                                >
                                    OK
                                </Button>
                            </Box>

                            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Historique</Typography>
                            <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                                {transactions.length === 0 && <ListItem><ListItemText secondary="Aucune transaction" /></ListItem>}
                                {transactions.map(tx => (
                                    <ListItem key={tx.id}>
                                        <ListItemText
                                            primary={tx.description}
                                            secondary={new Date(tx.created_at).toLocaleDateString()}
                                        />
                                        <Chip
                                            label={tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                            color={tx.amount > 0 ? "success" : "default"}
                                            size="small"
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
}
