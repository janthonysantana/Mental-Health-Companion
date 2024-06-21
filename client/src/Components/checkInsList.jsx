import React, { useState, useEffect} from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import {
    List, ListItemText, Typography, Card, Avatar,
    ListItemAvatar, Chip, Divider, Box, Tooltip, IconButton, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions, Button, Snackbar
  } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // Importing an icon for time
import RepeatIcon from '@mui/icons-material/Repeat'; // Importing an icon for frequency
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { styled } from '@mui/material/styles';


const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
 transition: 'transform 0.1s ease-in-out',
  '&:hover': {
    transform: 'scale(1.01)',
    boxShadow: theme.shadows[3],
  },
}));

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });

function CheckInsList() {
    const { userId } = useParams(); // Assuming 'user' has 'userId'
    const navigate = useNavigate();
    const [checkIns, setCheckIns] = useState([]);
    const [selectedCheckIn, setSelectedCheckIn] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('info');

    useEffect(() => {
        fetchCheckIns();
    }, [userId]);

        const fetchCheckIns = async () => {
            if (!userId) {
                setError('User not logged in');
                return;
            }
            setLoading(true);
            try {
                const response = await axios.get(`/api/checkIn/retrieveAll?user_id=${userId}`);
                console.log("API Response:", response.data);  // Confirm what you receive
                
                // Validate if data is an array and has the correct structure
                if (Array.isArray(response.data) && response.data.every(item => item._id && item._id.$oid && item.check_in_time && item.check_in_time.$date)) {
                    const formattedCheckIns = response.data.map(checkIn => ({
                        ...checkIn,
                        _id: checkIn._id.$oid,
                        check_in_time: new Date(checkIn.check_in_time.$date).toLocaleString(),  // Convert date from MongoDB format to a readable string
                    }));
                    setCheckIns(formattedCheckIns);
                } else {
                    console.error('Data received is not in expected array format:', response.data);
                    setError('Unexpected data format');
                }
                setLoading(false);
            } catch (err) {
                console.error("Error during fetch:", err);
                setError(err.message);
                setLoading(false);
            }
        };
    
        
    
    const handleOpenDialog = (checkInId) => {
        const checkIn = checkIns.find(c => c._id === checkInId);
        if (checkIn) {
          setSelectedCheckIn(checkIn);
          console.log("Selected check-in for details or update:", checkIn);
          setDialogOpen(true);
        }
      };
    
      const handleCloseDialog = () => {
        setDialogOpen(false);
        setDeleteConfirmOpen(false);
      };

      const handleDeleteCheckIn = async () => {
        if (selectedCheckIn) {
            try {
                await axios.delete(`/api/checkIn/delete/${selectedCheckIn._id}`);
                setSnackbarMessage('Check-in deleted successfully');
                setSnackbarSeverity('success');
                fetchCheckIns(); // Refresh the list after deletion
                handleCloseDialog();
            } catch (err) {
                setSnackbarMessage('Failed to delete check-in');
                setSnackbarSeverity('error');
            }
            setSnackbarOpen(true);
        }
    };

    const handleUpdateRedirect = () => {
        navigate(`/user/check_in/${selectedCheckIn._id}`);
        console.log("Redirecting to update check-in form", selectedCheckIn._id);
    };

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
          return;
        }
        setSnackbarOpen(false);
      };

    const handleOpenDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
    };

    if (!userId) return <Typography variant="h6">Please log in to see your check-ins.</Typography>;
    if (loading) return <Typography variant="h6">Loading...</Typography>;
    if (error) return <Typography variant="h6">Error: {error}</Typography>;

    return (
        <Box sx={{ margin: 3, maxWidth: 600, mx: 'auto' }}>
          <Typography variant="h4" gutterBottom>Track Your Commitments</Typography>
          <Divider sx={{ mb: 2 }} />
          {checkIns.length > 0 ? (
            <List>
              {checkIns.map(checkIn => (
                <StyledCard key={checkIn._id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: "primary.main" }}>
                      <AccessTimeIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`Check-In: ${checkIn.check_in_time}`}
                    secondary={<Chip label={checkIn.frequency} icon={<RepeatIcon />} size="small" />}
                  />
                  <Tooltip title="More options">
                  <IconButton onClick={() => handleOpenDialog(checkIn._id)}>
                  <MoreVertIcon />
                </IconButton>
                  </Tooltip>
                </StyledCard>
              ))}
            </List>
          ) : (
            <Typography variant="subtitle1">No check-ins found.</Typography>
          )}

          {/* Dialog for Check-In Details */}
          <Dialog open={dialogOpen} onClose={handleCloseDialog}>
            <DialogTitle>Check-In Details</DialogTitle>
            <DialogContent>
            <Typography component="div">
                {/* Displaying multiple attributes of a check-in */}
                <Typography variant="body1"><strong>Time:</strong> {selectedCheckIn?.check_in_time}</Typography>
                <Typography variant="body1"><strong>Frequency:</strong> {selectedCheckIn?.frequency}</Typography>
                <Typography variant="body1"><strong>Status:</strong> {selectedCheckIn?.status}</Typography>
                <Typography variant="body1"><strong>Notify:</strong> {selectedCheckIn?.notify ? 'Yes' : 'No'}</Typography>
                {/* You can add more details here as per your data model */}
            </Typography>
            </DialogContent>
            <DialogActions>
            <Button onClick={handleUpdateRedirect} startIcon={<EditIcon />}>Update</Button>
            <Button onClick={handleOpenDeleteConfirm} startIcon={<DeleteIcon />} color="error">Delete</Button>
            <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
        </Dialog>

        {/* Dialog for Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={handleCloseDialog}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this check-in? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCheckIn} color="error">Delete</Button>
          <Button onClick={handleCloseDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>

        {/* Snackbar for displaying success or error messages */}
        <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
            {snackbarMessage}
            </Alert>
        </Snackbar>

        </Box>
      );
    }
    
      

export default CheckInsList;