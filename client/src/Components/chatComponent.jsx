import React, { useState, useEffect, useContext,useCallback, useRef } from 'react';
import axios from 'axios';
import { Box, Card, CardContent, Typography, TextField, Button, List, ListItem,ListItemAvatar, ListItemText, CircularProgress, Snackbar, Divider } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import SendIcon from '@mui/icons-material/Send';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import StopIcon from '@mui/icons-material/Stop';
import PersonIcon from '@mui/icons-material/Person';
import { UserContext } from './userContext';
import Aria from '../Assets/Images/Aria.jpg'; // Adjust the path to where your logo is stored
import { Avatar } from '@mui/material';

const TypingIndicator = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
        <Avatar src={Aria} sx={{ width: 24, height: 24, marginRight: 1 }} alt="Aria" />
        <div style={{ display: 'flex' }}>
            <div style={{ animation: 'blink 1.4s infinite', width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor', marginRight: 2 }}></div>
            <div style={{ animation: 'blink 1.4s infinite 0.2s', width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor', marginRight: 2 }}></div>
            <div style={{ animation: 'blink 1.4s infinite 0.4s', width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
        </div>
    </Box>
);

const ChatComponent = () => {
    const { user } = useContext(UserContext);
    const userId = user?.userId; 
    const [chatId, setChatId] = useState(null);
    const [turnId, setTurnId] = useState(0);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const audioChunksRef = useRef([]);
    const [isLoading, setIsLoading] = useState(false); 
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [isFetchingMessage, setIsFetchingMessage] = useState(false);
    const [open, setOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('info');

    const fetchWelcomeMessage = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setIsFetchingMessage(true);
        try {
        const response = await fetch(`/api/ai/mental_health/welcome/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        console.log(data);
        if (response.ok) {
            setWelcomeMessage(data.message);
            setChatId(data.chat_id);
            console.log(data.chat_id);
        } else {
            console.error('Failed to fetch welcome message:', data);
            setWelcomeMessage('Error fetching welcome message.');
        }
    } catch (error) {
        console.error('Network or server error:', error);
    }finally {
        setIsLoading(false);
        setIsFetchingMessage(false);
    }      
}, [userId]);
    // Fetch initial message when component mounts
    useEffect(() => {
        fetchWelcomeMessage();
    }, [fetchWelcomeMessage]);
                

        const handleSnackbarClose = (event, reason) => {
            if (reason === 'clickaway') {
                return;
            }
            setOpen(false);
        };

        const finalizeChat = useCallback(async () => {
            if (chatId === null) return;
            setIsLoading(true);
            try {
                const response = await fetch(`/api/ai/mental_health/finalize/${userId}/${chatId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
    
                const data = await response.json();
        if (response.ok) {
            setSnackbarMessage('Chat finalized successfully');
            setSnackbarSeverity('success');
            // Reset chat state to start a new chat
            setChatId(null);
            setTurnId(0);
            setMessages([]);
            // Optionally, fetch a new welcome message or reset other relevant states
            fetchWelcomeMessage(); // assuming fetchWelcomeMessage resets or initiates a new chat session
        } else {
            setSnackbarMessage('Failed to finalize chat');
            setSnackbarSeverity('error');
        }
    } catch (error) {
        setSnackbarMessage('Error finalizing chat');
        setSnackbarSeverity('error');
    } finally {
        setIsLoading(false);
        setOpen(true);
    }
}, [userId, chatId, fetchWelcomeMessage]);
    
        const sendMessage = useCallback(async () => {
            if (!input.trim() || chatId === undefined) return;
            console.log(chatId);
            setIsLoading(true);
            
            
            try {
                const body = JSON.stringify({
                    prompt: input,
                    turn_id: turnId
                });
            const response = await fetch(`/api/ai/mental_health/${userId}/${chatId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
    
            const data = await response.json();
            console.log(data);    
            if (response.ok) {
                setMessages(prev => [...prev, { message: input, sender: 'user' }, { message: data, sender: 'agent' }]);
                setTurnId(prev => prev + 1);
                setInput('');
            } else {
                console.error('Failed to send message:', data.error || "Unknown error occurred");
                setSnackbarMessage(data.error || "An error occurred while sending the message.");
                setSnackbarSeverity('error');
                setOpen(true);
            } 
            }catch (error) {
                console.error('Failed to send message:', error);
                setSnackbarMessage('Network or server error occurred.');
                setSnackbarSeverity('error');
                setOpen(true);
            } finally {
                setIsLoading(false);
                
            }
        }, [input, userId, chatId, turnId]);

        // Function to handle recording start
        const startRecording = () => {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    audioChunksRef.current = []; // Clear the ref at the start of recording
                    const options = { mimeType: 'audio/webm' };
                    const recorder = new MediaRecorder(stream, options);
                    recorder.ondataavailable = (e) => {
                        console.log('Data available:', e.data.size); // Log size to check if data is present
                        audioChunksRef.current.push(e.data);
                    };
                    
                    recorder.start();
                    setMediaRecorder(recorder);
                    setIsRecording(true);
                }).catch(console.error);
        };

        // Function to handle recording stop
        const stopRecording = () => {
            if (mediaRecorder) {
                mediaRecorder.onstop = () => {
                    sendAudioToServer(audioChunksRef.current); // Ensure sendAudioToServer is called only after recording has fully stopped
                    setIsRecording(false);
                    setMediaRecorder(null);
                };
                mediaRecorder.stop(); // Stop recording, onstop will be triggered after this
            }
        };

        const sendAudioToServer = chunks => {
            console.log('Audio chunks size:', chunks.reduce((sum, chunk) => sum + chunk.size, 0)); // Log total size of chunks
            const audioBlob = new Blob(chunks, { 'type': 'audio/webm' });
            if (audioBlob.size === 0) {
                console.error('Audio Blob is empty');
                return;
            }
            console.log(`Sending audio blob of size: ${audioBlob.size} bytes`);
            const formData = new FormData();
            formData.append('audio', audioBlob);
            setIsLoading(true);
        
            axios.post('/api/ai/mental_health/voice-to-text', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })
            .then(response => {
                const { message } = response.data;
                setInput(message);
                sendMessage();
            })
            .catch(error => {
                console.error('Error uploading audio:', error);
                setOpen(true);
                setSnackbarMessage('Error processing voice input: ' + error.message);
                setSnackbarSeverity('error');
            })
            .finally(() => {
                        setIsLoading(false);
                    });
        }; // Remove audioChunks from dependencies to prevent re-creation
        



    
        // Handle input changes
        const handleInputChange = useCallback((event) => {
            setInput(event.target.value);
        }, []);

        return (
            <>
            <style>
                {`
                    @keyframes blink {
                        0%, 100% { opacity: 0; }
                        50% { opacity: 1; }
                    }
                `}
            </style>
            <Box sx={{ maxWidth: '100%', mx: 'auto', my: 2, display: 'flex', flexDirection: 'column', height: '91vh',borderRadius: 2, boxShadow: 1 }}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%',borderRadius: 2,boxShadow: 3 }}>
                    <CardContent sx={{ flexGrow: 1, overflow: 'auto',padding: 3 }}>
                    {messages.length === 0 && (
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                mt: -3,
                                mb: 2,
                                p: 2,
                                overflow: 'hidden',  // Ensures nothing spills out of the box
                                maxWidth: '100%',    // Limits the width to prevent overflow
                                maxHeight: '80%',  // Adjusts the maximum height of the logo area
                            }}>
                                <img src={Aria} alt="App Logo" style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                                    width: 'auto', // Ensures the width automatically adjusts based on height
                                    height: 'auto', // Auto height for proper scaling without specifying vh
                                    objectFit: 'contain',  // Ensures the image scales properly within its constraints
                                    borderRadius: '50%' // Optional: Makes the image circular
                                }} />
                            </Box>
                            
                        )}
                    <Box sx={{ display: 'flex', marginBottom: 2, marginTop:3}}>
                    <Avatar src={Aria} sx={{ width: 44, height: 44, marginRight: 2,  }} alt="Aria" />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Welcome to Mental Health Companion
                        </Typography>
                        </Box>
                        
                        {isFetchingMessage ? <TypingIndicator /> : 
                        <Box sx={{ display: 'flex'}}>
                        <Avatar src={Aria} sx={{ width: 36, height: 36, marginRight: 1,  }} alt="Aria" />
                        <Typography variant="body1" gutterBottom sx={{ bgcolor: 'grey.200',borderRadius: '16px',
                                        px: 2, // padding left and right within the text
                                        py: 1, // padding top and bottom within the text
                                        display: 'inline-block',}}>
                            {welcomeMessage}
                        </Typography>
                        </Box>
                        }
                        <List sx={{ maxHeight: '100%', overflow: 'auto' }}>
                            {messages.map((msg, index) => (
                                <ListItem key={index}sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    //backgroundColor: msg.sender === 'user' ? 'primary.light' : 'grey.100',  // Adjust colors here
                                    borderRadius: 2, // Optional: Adds rounded corners
                                    mb: 0.5, // Margin bottom for spacing between messages
                                    p: 1 // Padding inside each list item
                                }}>
                                    <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: msg.sender === 'user' ? 'common.white' : 'text.primary',
                                    borderRadius: '16px',
                                    
                                    
                                }}>
                                    
                                     {msg.sender === 'agent' && (
                                        <Avatar src={Aria} sx={{ width: 36, height: 36, mr: 1 }} alt="Aria" />
                                    )}
                                    
                                    
                                    <ListItemText primary={msg.message} primaryTypographyProps={{
                                        
                                    sx: { 
                                        color: msg.sender === 'user' ? 'common.white' : 'text.primary',
                                        //textAlign: msg.sender === 'user' ? 'right' : 'left',
                                        bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.200', // You can adjust the background color here
                                        borderRadius: '16px', // Adds rounded corners to the text
                                        px: 2, // padding left and right within the text
                                        py: 1, // padding top and bottom within the text
                                        display: 'inline-block', // Ensures the background color wraps the text only
                                    }
                                    
                                }} />
                                {msg.sender === 'user' && (
                                    <Avatar sx={{ width: 36, height: 36, ml: 1 }}>
                                    <PersonIcon />
                                  </Avatar>
                                )}
                                </Box>
                                </ListItem>   
                            ))}
                        </List>
                    </CardContent>
                    <Divider />
                    <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center',bgcolor: 'background.paper' }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Type your message here..."
                            value={input}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            sx={{ mr: 1, flexGrow: 1 }}
                        />
                            <Button onClick={isRecording ? stopRecording : startRecording} 
                                variant="contained" 
                                color="secondary" 
                                startIcon={isRecording ? <StopIcon /> : <RecordVoiceOverIcon />}>
                            {isRecording ? 'Stop Recording' : 'Start Recording'}
                        </Button>
                        {isLoading ? <CircularProgress size={24} /> : (
                            <Button variant="contained" color="primary" onClick={sendMessage} disabled={isLoading || !input.trim()} endIcon={<SendIcon />}>
                                Send
                            </Button>
                        )}
                    </Box>
                    <Button
                    variant="outlined"
                    color="error"
                    startIcon={<ExitToAppIcon />}
                    onClick={finalizeChat}
                    disabled={isLoading}
                    sx={{mt: 1,backgroundColor: theme => theme.palette.error.light + '33', // Adds an alpha value for transparency, making it lighter
                         
                        '&:hover': {
                            color: 'common.white',// White text for better contrast
                            backgroundColor: theme => theme.palette.error.light, // Slightly darker on hover but still lighter than default
                        } }
                    }
                >
                    {isLoading ? <CircularProgress color="inherit" /> : 'End Chat'}
                </Button>
                </Card>
                <Snackbar open={open} autoHideDuration={6000} onClose={handleSnackbarClose}>
                    <MuiAlert elevation={6} variant="filled" onClose={handleSnackbarClose} severity={snackbarSeverity}>
                        {snackbarMessage}
                    </MuiAlert>
                </Snackbar>
            </Box>
            </>
        );
    };
    
    
export default ChatComponent;
