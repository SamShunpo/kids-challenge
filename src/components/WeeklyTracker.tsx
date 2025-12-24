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
    created_at?: string;
}

interface WeeklyTrackerProps {
    childId: string;
    objectives: Objective[];
    exclusions: any[];
    onUpdate?: () => void;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Helper to get current week's Monday
const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

export default function WeeklyTracker({ childId, objectives, exclusions, onUpdate }: WeeklyTrackerProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, [childId, currentWeekStart]);

    const changeWeek = (offset: number) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (offset * 7));
        setCurrentWeekStart(newDate);
        setShowAll(false); // Reset showAll when changing week
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
                onUpdate?.();
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
                onUpdate?.();
            }
        }
    };

    const handleExclude = async (objId: string) => {
        if (!confirm("Masquer cet objectif pour cette semaine uniquement ?")) return;

        // Convert currentWeekStart to YYYY-MM-DD
        const d = new Date(currentWeekStart);
        const sy = d.getFullYear();
        const sm = String(d.getMonth() + 1).padStart(2, '0');
        const sd = String(d.getDate()).padStart(2, '0');
        const weekStr = `${sy}-${sm}-${sd}`;

        try {
            const { error } = await supabase.from('objective_exclusions').insert({
                objective_id: objId,
                week_start: weekStr,
                child_id: childId // Ensure child_id is sent!
            });

            if (error) throw error;
            onUpdate?.(); // Refresh dashboard to fetch new exclusions
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'exclusion");
        }
    };

    // filter objectives active for this week
    const activeObjectives = objectives.filter(obj => {
        // 1. Check Soft Delete
        if (obj.deleted_at && new Date(obj.deleted_at) <= currentWeekStart) return false;

        // 2. Check Exclusions
        // exclusions might be passed as prop. 
        // currentWeekStart needs to match exclusion week_start.
        const startObj = new Date(currentWeekStart);
        const sy = startObj.getFullYear();
        const sm = String(startObj.getMonth() + 1).padStart(2, '0');
        const sd = String(startObj.getDate()).padStart(2, '0');
        const weekStr = `${sy}-${sm}-${sd}`;

        const isExcluded = exclusions?.some(ex => ex.objective_id === obj.id && ex.week_start === weekStr);
        if (isExcluded) return false;

        // 3. Check Creation Date (Smart Start)
        // Rule: If created on Mon, active this week. If Tue+, active next week.
        if (!showAll && obj.created_at) {
            const created = new Date(obj.created_at);
            // Get Monday of creation week
            const day = created.getDay();
            const diff = created.getDate() - day + (day === 0 ? -6 : 1);
            const creationMon = new Date(created);
            creationMon.setDate(diff);
            creationMon.setHours(0, 0, 0, 0);

            // If created AFTER this week's Monday, it's definitely not active yet (unless we are IN the creation week?)
            // If currentWeekStart < creationMon, it's in future? No, we view past/future weeks.

            // If currentWeekStart < effectiveStartWeek, hide.

            let effectiveStart = new Date(creationMon);
            // If created day is NOT Monday (1), add 7 days
            // Actually, verify "Monday rule".
            // "created on Monday -> start current week". 
            // "created on Tuesday -> start next week".
            // So if created.getDay() !== 1, effectiveStart = creationMon + 7 days.

            // Note: getDay() 0=Sun, 1=Mon.
            // If created on Sun (0), it belongs to "previous" week in JS sense (week starts Sun), but "this" week in ISO (starts Mon).
            // Let's stick to the Monday calculation logic:
            // creationMon is the Monday of the week the date falls in.
            // If created date > creationMon (meaning Tue-Sun), then effective is next week.
            // BUT: created is timestamp. creationMon is midnight.
            // If created is Monday, created date is same day as creationMon.
            // Just compare dates.

            const isMonday = created.getDay() === 1;
            if (!isMonday) {
                effectiveStart.setDate(effectiveStart.getDate() + 7);
            }

            if (currentWeekStart < effectiveStart) return false;
        }

        return true;
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

    const isPastWeek = currentWeekStart < getMonday(new Date());

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => changeWeek(-1)} size="small"><ChevronLeftIcon /></IconButton>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1 }}>{rangeStr}</Typography>
                    {isPastWeek && (
                        <Box
                            component="span"
                            onClick={() => setShowAll(!showAll)}
                            sx={{
                                fontSize: '0.7rem',
                                color: 'primary.main',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                display: 'block',
                                mt: 0.5
                            }}
                        >
                            {showAll ? 'Masquer inactifs' : 'Voir tout'}
                        </Box>
                    )}
                </Box>
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
                            <TableCell sx={{ pl: 1, pr: 0, py: 0.5, fontSize: '0.7rem', width: 'auto' }}>Objectif</TableCell>
                            {DAYS.map(d => <TableCell key={d} align="center" padding="none" sx={{ width: 28, fontSize: '0.7rem' }}>{d[0]}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {activeObjectives.map(obj => (
                            <TableRow key={obj.id}>
                                <TableCell component="th" scope="row" sx={{ fontSize: '0.75rem', pl: 1, pr: 0, py: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Box sx={{ flexGrow: 1, lineHeight: 1.1 }}>{obj.title}</Box>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleExclude(obj.id)}
                                            sx={{ opacity: 0.2, p: 0.2, '&:hover': { opacity: 1 }, ml: 0.5 }}
                                        >
                                            <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                    </Box>
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
