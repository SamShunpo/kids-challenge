import { useEffect, useState } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Checkbox, CircularProgress, Chip, IconButton
} from '@mui/material';
import { supabase } from '../supabaseClient';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Objective {
    id: string;
    title: string;
    deleted_at?: string | null;
}

interface WeeklyTrackerProps {
    childId: string;
    objectives: Objective[];
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Helper to get current week's Monday
const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

export default function WeeklyTracker({ childId, objectives }: WeeklyTrackerProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));

    useEffect(() => {
        fetchLogs();
    }, [childId, currentWeekStart]);

    const changeWeek = (offset: number) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setCurrentWeekStart(newDate);
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            // Calc week range
            // Use local dates for query
            const startObj = new Date(currentWeekStart);
            const sy = startObj.getFullYear();
            const sm = String(startObj.getMonth() + 1).padStart(2, '0');
            const sd = String(startObj.getDate()).padStart(2, '0');
            const start = `${sy}-${sm}-${sd}`;

            const endObj = new Date(currentWeekStart);
            endObj.setDate(endObj.getDate() + 7);
            const ey = endObj.getFullYear();
            const em = String(endObj.getMonth() + 1).padStart(2, '0');
            const ed = String(endObj.getDate()).padStart(2, '0');
            const end = `${ey}-${em}-${ed}`;

            const { data, error } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('child_id', childId)
                .gte('date', start)
                .lt('date', end);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching logs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (objectiveId: string, dayIndex: number) => {
        const dateObj = new Date(currentWeekStart);
        dateObj.setDate(dateObj.getDate() + dayIndex);
        // Use local date string YYYY-MM-DD
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const existing = logs.find(l =>
            l.objective_id === objectiveId &&
            l.date === dateStr
        );

        if (existing) {
            const { error } = await supabase
                .from('daily_logs')
                .delete()
                .eq('id', existing.id);

            if (!error) {
                setLogs(logs.filter(l => l.id !== existing.id));
            }
        } else {
            const { data, error } = await supabase
                .from('daily_logs')
                .insert({
                    child_id: childId,
                    objective_id: objectiveId,
                    date: dateStr,
                    is_completed: true
                })
                .select();

            if (!error && data) {
                setLogs([...logs, data[0]]);
            }
        }
    };

    // filter objectives active for this week
    const activeObjectives = objectives.filter(obj => {
        if (!obj.deleted_at) return true;
        return new Date(obj.deleted_at) > currentWeekStart;
    });

    // Scoring Logic
    let score = 0;
    let perfectObjectives = 0;

    activeObjectives.forEach(obj => {
        const completedDays = logs.filter(l => l.objective_id === obj.id && l.is_completed).length;
        if (completedDays === 7) {
            score += 1;
            perfectObjectives++;
        }
    });

    const isPerfectWeek = activeObjectives.length > 0 && perfectObjectives === activeObjectives.length;
    if (isPerfectWeek) {
        score = perfectObjectives * 2;
    }

    if (loading) return <CircularProgress size={20} />;

    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    const rangeStr = `${currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => changeWeek(-1)} size="small"><ChevronLeftIcon /></IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{rangeStr}</Typography>
                <IconButton onClick={() => changeWeek(1)} size="small"><ChevronRightIcon /></IconButton>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1, bgcolor: 'primary.light', color: 'white', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Score Hebdo : {score}
                </Typography>
                {isPerfectWeek && <Chip label="SEMAINE PARFAITE ! x2" color="secondary" sx={{ fontWeight: 'bold' }} />}
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ pl: 1, pr: 0.5, py: 0.5, fontSize: '0.75rem' }}>Objectif</TableCell>
                            {DAYS.map(d => <TableCell key={d} align="center" padding="none" sx={{ width: 32, fontSize: '0.75rem' }}>{d[0]}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {activeObjectives.map(obj => (
                            <TableRow key={obj.id}>
                                <TableCell component="th" scope="row" sx={{ fontSize: '0.75rem', pl: 1, pr: 0.5, py: 0.5 }}>
                                    {obj.title}
                                </TableCell>
                                {DAYS.map((_, index) => {
                                    const dateObj = new Date(currentWeekStart);
                                    dateObj.setDate(dateObj.getDate() + index);

                                    const year = dateObj.getFullYear();
                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                    const dateStr = `${year}-${month}-${day}`;

                                    const log = logs.find(l => l.objective_id === obj.id && l.date === dateStr);
                                    const isDone = log?.is_completed;

                                    return (
                                        <TableCell key={index} align="center" padding="none">
                                            <Checkbox
                                                checked={!!isDone}
                                                onChange={() => handleToggle(obj.id, index)}
                                                icon={<RadioButtonUncheckedIcon fontSize="small" color="action" />}
                                                checkedIcon={<CheckCircleIcon fontSize="small" color="success" />}
                                                size="small"
                                            />
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box >
    );
}
