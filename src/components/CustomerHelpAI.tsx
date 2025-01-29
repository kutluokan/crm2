import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Button,
  Input,
  Box,
  Text,
  Heading,
  VStack,
  Spinner,
  Flex,
  useToast
} from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function CustomerHelpAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    checkUserProfile();
    // Initial greeting
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?'
    }]);
  }, []);

  const checkUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Try to get the user's profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        // Try to create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase.rpc(
          'create_profile_if_not_exists',
          { user_id: user.id, user_role: 'customer' }
        );

        if (createError) {
          console.error('Error creating profile:', createError);
          toast({
            title: 'Error',
            description: 'Failed to create user profile. Please try logging in again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify user profile. Please try logging in again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call AI function endpoint using Supabase Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      // First add AI's response to messages
      const aiMessage: Message = { role: 'assistant', content: data.content };
      setMessages(prev => [...prev, aiMessage]);
      
      // If ticket was created, show message and navigate
      if (data.createTicket && data.ticketSummary) {
        const ticketMessage: Message = { 
          role: 'assistant', 
          content: `I've created a support ticket (#${data.ticketSummary.ticketId}) for you with the title: "${data.ticketSummary.title}". Redirecting you to the ticket page...` 
        };
        setMessages(prev => [...prev, ticketMessage]);
        
        // Wait a moment to show the message before redirecting
        setTimeout(() => {
          navigate(`/tickets/${data.ticketSummary.ticketId}`);
        }, 2000);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="800px" mx="auto" p={6}>
      <Box bg="white" p={6} borderRadius="lg" shadow="base">
        <Heading size="md" mb={4}>
          AI Help Assistant
        </Heading>
        
        <VStack spacing={4} h="60vh" overflowY="auto" mb={4} align="stretch">
          {messages.map((message, index) => (
            <Box
              key={index}
              p={4}
              bg={message.role === 'assistant' ? 'gray.50' : 'blue.50'}
              borderRadius="md"
            >
              <Text>{message.content}</Text>
            </Box>
          ))}
          {loading && (
            <Flex justify="center" p={4}>
              <Spinner size="md" />
            </Flex>
          )}
        </VStack>

        <Flex gap={2}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message here..."
            disabled={loading}
          />
          <Button
            colorScheme="blue"
            onClick={handleSend}
            isDisabled={loading}
            leftIcon={<FiSend />}
          >
            Send
          </Button>
        </Flex>
      </Box>
    </Box>
  );
} 