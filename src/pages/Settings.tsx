import { useEffect, useState } from 'react';
import {
  Typography, Box, List, ListItem, ListItemAvatar, Avatar,
  ListItemText, IconButton, Dialog, DialogTitle,
  DialogContent, TextField, DialogActions, Button, CircularProgress, Divider,
  FormControl, InputLabel, Select, MenuItem, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import { supabase } from '../supabaseClient';

interface Child {
  id: string;
  name: string;
  avatar_url?: string;
}

interface Objective {
  id: string;
  title: string;
  description?: string;
  child_id?: string | null; // null = all
}

export default function Settings() {
  const [children, setChildren] = useState<Child[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [openChildDialog, setOpenChildDialog] = useState(false);
  const [openObjDialog, setOpenObjDialog] = useState(false);

  // Form States
  const [newChildName, setNewChildName] = useState('');

  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjChildId, setNewObjChildId] = useState<string>('all'); // 'all' or UUID

  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [childRes, objRes] = await Promise.all([
        supabase.from('children').select('*').order('created_at'),
        supabase.from('objectives').select('*').order('created_at')
      ]);

      if (childRes.error) throw childRes.error;
      if (objRes.error) throw objRes.error;

      setChildren(childRes.data || []);
      setObjectives(objRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChild = async () => {
    if (!newChildName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('children')
        .insert([{ name: newChildName.trim() }])
        .select();

      if (error) throw error;
      if (data) {
        setChildren([...children, data[0]]);
        setOpenChildDialog(false);
        setNewChildName('');
      }
    } catch (error) {
      alert("Erreur lors de l'ajout de l'enfant");
    } finally {
      setAdding(false);
    }
  };

  const handleAddObjective = async () => {
    if (!newObjTitle.trim()) return;
    setAdding(true);
    try {
      const payload: any = { title: newObjTitle.trim() };
      if (newObjChildId !== 'all') {
        payload.child_id = newObjChildId;
      }

      const { data, error } = await supabase
        .from('objectives')
        .insert([payload])
        .select();

      if (error) throw error;
      if (data) {
        setObjectives([...objectives, data[0]]);
        setOpenObjDialog(false);
        setNewObjTitle('');
        setNewObjChildId('all');
      }
    } catch (error) {
      alert("Erreur lors de l'ajout de l'objectif");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteChild = async (id: string) => {
    if (!confirm('Êtes-vous sûr ? Tout l\'historique pour cet enfant sera perdu.')) return;
    const { error } = await supabase.from('children').delete().eq('id', id);
    if (!error) setChildren(children.filter(c => c.id !== id));
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('Êtes-vous sûr ? Tout l\'historique pour cet objectif sera perdu.')) return;
    const { error } = await supabase.from('objectives').delete().eq('id', id);
    if (!error) setObjectives(objectives.filter(o => o.id !== id));
  };

  const getChildName = (id?: string | null) => {
    if (!id) return 'Tout le monde';
    const child = children.find(c => c.id === id);
    return child ? child.name : 'Inconnu';
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom>Paramètres</Typography>

      {/* Children Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Enfants</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setOpenChildDialog(true)} size="small">
            Ajouter
          </Button>
        </Box>
        <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
          {children.length === 0 && <ListItem><ListItemText secondary="Aucun enfant." /></ListItem>}
          {children.map((child) => (
            <ListItem
              key={child.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDeleteChild(child.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'secondary.main' }}><PersonIcon /></Avatar>
              </ListItemAvatar>
              <ListItemText primary={child.name} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Objectives Section */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Objectifs</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setOpenObjDialog(true)} size="small">
            Ajouter
          </Button>
        </Box>
        <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
          {objectives.length === 0 && <ListItem><ListItemText secondary="Aucun objectif." /></ListItem>}
          {objectives.map((obj) => (
            <ListItem
              key={obj.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleDeleteObjective(obj.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main' }}><StarIcon /></Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={obj.title}
                secondary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Chip
                      label={getChildName(obj.child_id)}
                      size="small"
                      variant="outlined"
                      color={obj.child_id ? 'secondary' : 'default'}
                    />
                    {obj.description}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Dialogs */}
      <Dialog open={openChildDialog} onClose={() => setOpenChildDialog(false)}>
        <DialogTitle>Ajouter un Enfant</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Prénom" fullWidth value={newChildName} onChange={e => setNewChildName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenChildDialog(false)}>Annuler</Button>
          <Button onClick={handleAddChild} disabled={adding}>{adding ? '...' : 'Ajouter'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openObjDialog} onClose={() => setOpenObjDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ajouter un Objectif</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Titre de l'objectif"
            fullWidth
            value={newObjTitle}
            onChange={e => setNewObjTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel id="assign-select-label">Assigner à</InputLabel>
            <Select
              labelId="assign-select-label"
              value={newObjChildId}
              label="Assigner à"
              onChange={(e) => setNewObjChildId(e.target.value)}
            >
              <MenuItem value="all">Tout le monde</MenuItem>
              {children.map(child => (
                <MenuItem key={child.id} value={child.id}>{child.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenObjDialog(false)}>Annuler</Button>
          <Button onClick={handleAddObjective} disabled={adding}>{adding ? '...' : 'Ajouter'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
