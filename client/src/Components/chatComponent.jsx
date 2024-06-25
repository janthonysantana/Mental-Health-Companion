import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import apiServerAxios from '../api/axios';
import { InputAdornment, IconButton, Box, Card, CardContent, Typography, TextField, Button, List, ListItem, ListItemAvatar, ListItemText, CircularProgress, Snackbar, Divider, Avatar, Tooltip } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PersonIcon from '@mui/icons-material/Person';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import { UserContext } from './userContext';
import Aria from '../Assets/Images/Aria.jpg'; // Adjust the path to where your logo is stored


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
    const { user, voiceEnabled } = useContext(UserContext);
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
    const [currentPlayingMessage, setCurrentPlayingMessage] = useState(null);


    
    const speak = (text) => {

        if (!voiceEnabled || text === currentPlayingMessage) {
            setCurrentPlayingMessage(null);
            window.speechSynthesis.cancel(); // Stop the current speech synthesis
            return;
        }
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        const setVoiceAndSpeak = () => {
            const voices = synth.getVoices();
            console.log(voices.map(voice => `${voice.name} - ${voice.lang} - ${voice.gender}`));

            const femaleVoice = voices.find(voice => voice.name.includes("Microsoft Zira - English (United States)")); // Example: Adjust based on available voices

            if (femaleVoice) {
                utterance.voice = femaleVoice;
            } else {
                console.log("No female voice found");
            }

            utterance.onend = () => {
                setCurrentPlayingMessage(null); // Reset after speech has ended
            };

            setCurrentPlayingMessage(text);
            synth.speak(utterance);
        };

        if (synth.getVoices().length === 0){
            synth.onvoiceschanged = setVoiceAndSpeak;
        } else {
            setVoiceAndSpeak();
        }
    };


    const fetchWelcomeMessage = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        setIsFetchingMessage(true);
        try {
            const response = await apiServerAxios.post(`/api/ai/mental_health/welcome/${userId}`);
            if (response && response.data) {
                const data = response.data
                setWelcomeMessage(data.message);
                if (voiceEnabled && data.message) { // Ensure voice is enabled and the message is not empty
                    speak(data.message);
                }
                setChatId(data.chat_id);
                console.log(data.chat_id);
            } else {
                console.error('Failed to fetch welcome message:', data);
                setWelcomeMessage('Error fetching welcome message.');
            }
        } catch (error) {
            console.error('Network or server error:', error);
        } finally {
            setIsLoading(false);
            setIsFetchingMessage(false);
        }
    }, [userId]);
    // Fetch initial message when component mounts
    useEffect(() => {
        fetchWelcomeMessage();
    }, []);


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
            const response = await apiServerAxios.patch(`/api/ai/mental_health/finalize/${userId}/${chatId}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (response) {
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
            const body = {
                prompt: input,
                turn_id: turnId
            };
            const response = await apiServerAxios.post(`/api/ai/mental_health/${userId}/${chatId}`, {
                ...body
            });

            const data = response.data;
            if (response && data) {
                setMessages(prev => [...prev, { message: input, sender: 'user' }, { message: data, sender: 'agent' }]);
                // Speak the agent's message immediately after it's received and processed
                if (voiceEnabled && data) { // Ensure voice is enabled and the message is not empty
                    speak(data);
                }
                setTurnId(prev => prev + 1);
                setInput('');
            } else {
                console.error('Failed to send message:', data.error || "Unknown error occurred");
                setSnackbarMessage(data.error || "An error occurred while sending the message.");
                setSnackbarSeverity('error');
                setOpen(true);
            }
        } catch (error) {
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

        apiServerAxios.post('/api/ai/mental_health/voice-to-text', formData, {
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
        const inputText = event.target.value;
        const words = inputText.split(/\s+/);
        if (words.length > 200) {
            // If the word count exceeds 200, prevent further input by not updating the state
            setInput(input => input.split(/\s+/).slice(0, 200).join(" "));
            setSnackbarMessage('Word limit reached. Only 200 words allowed.');
            setSnackbarSeverity('warning');
            setOpen(true);
        } else {
            setInput(inputText);
        }
    }, []);

    const messageIcon = (message) => {
        return message === currentPlayingMessage ? <VolumeOffIcon /> : <VolumeUpIcon />;
    }

    return (
        <>
            <style>
                {`
                    @keyframes blink {
                        0%, 100% { opacity: 0; }
                        50% { opacity: 1; }
                    }
                        @media (max-width: 720px) {
                        .new-chat-button {
                            
                            top: 5px;
                            right: 5px;
                            padding: 4px 8px; /* Smaller padding */
                            font-size: 0.8rem; /* Smaller font size */
                        }
                    }
                `}
            </style>
            <Box sx={{ maxWidth: '100%', mx: 'auto', my: 2, display: 'flex', flexDirection: 'column', height: '91vh', borderRadius: 2, boxShadow: 1 }}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 2, boxShadow: 3 }}>
                    <CardContent sx={{ flexGrow: 1, overflow: 'auto', padding: 3, position: 'relative' }}>

                        <Tooltip title="Start a new chat" placement="top" arrow>
                            <IconButton
                                aria-label="new chat"
                                //variant="outlined"
                                color="primary"
                                onClick={finalizeChat}
                                disabled={isLoading}
                                sx={{
                                    position: 'absolute', // Positioning the button at the top-right corner
                                    top: 5, // Top margin
                                    right: 5, // Right margin
                                    '&:hover': {
                                        backgroundColor: 'primary.main',
                                        color: 'common.white',
                                    }
                                }}
                            >
                                <LibraryAddIcon />
                            </IconButton>
                        </Tooltip>

                        {welcomeMessage.length === 0 && (
                            <Box sx={{ display: 'flex', marginBottom: 2, marginTop: 3 }}>
                                <Avatar src={Aria} sx={{ width: 44, height: 44, marginRight: 2, }} alt="Aria" />
                                <Typography variant="h4" component="h1" gutterBottom>
                                    Welcome to Mental Health Companion
                                </Typography>
                            </Box>)}


                        {isFetchingMessage ? <TypingIndicator /> :
                            (messages.length === 0 && (
                                <Box sx={{ display: 'flex' }}>
                                    <Avatar src={Aria} sx={{ width: 36, height: 36, marginRight: 1, }} alt="Aria" />
                                    <Typography variant="body1" gutterBottom sx={{
                                        bgcolor: 'grey.200', borderRadius: '16px',
                                        px: 2, // padding left and right within the text
                                        py: 1, // padding top and bottom within the text
                                        display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap'
                                    }}>
                                        {welcomeMessage}
                                        {voiceEnabled && welcomeMessage && (
                                            <IconButton onClick={() => speak(welcomeMessage)} size="small" sx={{ ml: 1, }}>
                                                {messageIcon(welcomeMessage)}
                                            </IconButton>)}
                                    </Typography>
                                </Box>))
                        }
                        <List sx={{ maxHeight: '100%', overflow: 'auto' }}>
                            {messages.map((msg, index) => (
                                <ListItem key={index} sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    //backgroundColor: msg.sender === 'user' ? 'primary.light' : 'grey.100',  // Adjust colors here
                                    borderRadius: 2, // Optional: Adds rounded corners
                                    mb: 0.5, // Margin bottom for spacing between messages
                                    p: 1, // Padding inside each list item
                                    border: 'none', // Added to remove any border or underline
                                    '&:before': { // Targeting pseudo-elements which might create lines
                                        display: 'none'
                                    },
                                    '&:after': { // Same as above
                                        display: 'none'
                                    }
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


                                        <ListItemText primary={<Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}>
                                            {msg.message}
                                            {voiceEnabled && msg.sender === 'agent' && (
                                                <IconButton onClick={() => speak(msg.message)} size="small" sx={{ ml: 1, }}>
                                                    {messageIcon(msg.message)}
                                                </IconButton>)}
                                        </Box>} primaryTypographyProps={{

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
                    <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', bgcolor: 'background.paper' }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Type your message here..."
                            value={input}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            sx={{ mr: 1, flexGrow: 1 }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={isRecording ? stopRecording : startRecording}
                                            color="primary.main"
                                            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                                            size="large"
                                            edge="end"
                                            disabled={isLoading}
                                        >
                                            {isRecording ? <MicOffIcon size="small" /> : <MicIcon size="small" />}
                                            {isRecording && <CircularProgress size={30} sx={{
                                                color: 'primary.main',
                                                position: 'absolute',
                                                zIndex: 1
                                            }} />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {isLoading ? <CircularProgress size={24} /> : (
                            <Button variant="contained" color="primary" onClick={sendMessage} disabled={isLoading || !input.trim()} endIcon={<SendIcon />}>
                                Send
                            </Button>
                        )}
                    </Box>
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
