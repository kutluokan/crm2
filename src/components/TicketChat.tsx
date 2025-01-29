import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Input,
  Button,
  VStack,
  HStack,
  Text,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  IconButton,
  useToast,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tooltip,
} from '@chakra-ui/react';
import { FiPaperclip, FiSearch, FiMoreVertical, FiTrash2, FiFile } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { Database } from '../types/supabase';

interface UserProfile {
  full_name: string;
  role: Database['public']['Enums']['user_role'];
}

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  is_internal: boolean;
  user: UserProfile;
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
  isSupport: boolean;
}

interface Document {
  id: string;
  filename: string;
  similarity?: number;  // Optional since it's only used in search results
  ticket_id: string;
  created_at: string;
}

interface SearchDocument extends Document {
  similarity: number;  // Required in search results
}

interface DocumentRow {
  id: string;
  filename: string;
  ticket_id: string;
  created_at: string;
}

type MessageWithProfile = {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  is_internal: boolean;
  profiles: {
    full_name: string | null;
    role: Database['public']['Enums']['user_role'];
  };
};

export default function TicketChat({ ticketId, currentUserId, isSupport }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isRagQuery, setIsRagQuery] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isTicketOwner, setIsTicketOwner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    let isMounted = true;

    const loadMessagesIfMounted = async () => {
      if (isMounted) {
        await loadMessages();
        await fetchFiles();
        await getCurrentUser();
        await checkTicketOwnership();
      }
    };

    loadMessagesIfMounted();
    const subscription = setupMessagesSubscription();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function setupMessagesSubscription() {
    return supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          // Handle different types of changes
          switch (payload.eventType) {
            case 'DELETE':
              setMessages(prev => prev.filter(m => m.id !== payload.old.id));
              break;
            case 'INSERT':
            case 'UPDATE':
            default:
              loadMessages();
              break;
          }
        }
      )
      .subscribe();
  }

  async function loadMessages() {
    try {
      if (!ticketId) {
        console.error('No ticket ID provided for TicketChat.');
        return;
      }

      const { data, error } = await supabase
        .from('ticket_messages')
        .select(`
          id,
          message,
          created_at,
          user_id,
          is_internal,
          profiles!inner(
            full_name,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      // Transform the data to ensure it matches our Message type
      const rawMessages = data as unknown as MessageWithProfile[];

      const transformedMessages: Message[] = rawMessages.map(msg => ({
        id: msg.id,
        message: msg.message,
        created_at: msg.created_at,
        user_id: msg.user_id,
        is_internal: msg.is_internal,
        user: {
          full_name: msg.profiles.full_name ?? '',
          role: msg.profiles.role
        }
      }));

      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          filename,
          ticket_id,
          created_at
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const documents: Document[] = (data as DocumentRow[] || []).map(file => ({
        id: file.id,
        filename: file.filename,
        ticket_id: file.ticket_id,
        created_at: file.created_at
      }));

      setFiles(documents);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: 'Error fetching files',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserRole(profile.role);
      }
    }
  };

  const checkTicketOwnership = async () => {
    if (!userId) return;
    
    try {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('customer_id')
        .eq('id', ticketId)
        .single();

      setIsTicketOwner(ticket?.customer_id === userId);
    } catch (error) {
      console.error('Error checking ticket ownership:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);

      // Upload file to Supabase Storage
      const filename = `${ticketId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filename, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          ticket_id: ticketId,
          filename,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Process document and generate embeddings
      const { error: processError } = await supabase.functions
        .invoke('process-document', {
          body: { documentId: document?.id },
        });

      if (processError) throw processError;

      toast({
        title: 'Document uploaded successfully',
        status: 'success',
        duration: 3000,
      });

      // Add system message about the upload
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        user_id: currentUserId,
        message: `Uploaded document: ${file.name}`,
        is_internal: false,
      });

    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error uploading document',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsLoading(true);

      if (isRagQuery) {
        // Perform RAG query
        const { data: response, error: ragError } = await supabase.functions
          .invoke('rag-query', {
            body: { 
              query: newMessage,
              ticketId,
            },
          });

        if (ragError) throw ragError;

        // Add user query
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: `🔍 ${newMessage}`,
          is_internal: isInternal,
        });

        // Add AI response with document references
        const documentList = response.documents
          .map((doc: SearchDocument) => `- ${doc.filename} (${Math.round(doc.similarity * 100)}% match)`)
          .join('\n');

        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: `🤖 ${response.answer}\n\nReferences:\n${documentList}`,
          is_internal: isInternal,
        });
      } else {
        // Regular message
        const { data, error } = await supabase.functions.invoke('chat', {
          body: { 
            ticketId,
            message: newMessage,
            isInternal,
            isRagQuery 
          },
        });

        if (error) throw error;
        
        if (!data || typeof data.message !== 'string') {
          throw new Error('Invalid response from chat function');
        }

        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: data.message,
          is_internal: isInternal,
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, messageUserId: string) => {
    // Check permissions
    if (userRole !== 'admin' && userRole !== 'support' && userId !== messageUserId) {
      toast({
        title: 'Permission Denied',
        description: 'You can only delete your own messages',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // Delete from database with proper constraints
      const { error } = await supabase
        .from('ticket_messages')
        .delete()
        .match({ 
          id: messageId, 
          ticket_id: ticketId 
        });

      if (error) {
        throw error;
      }

      // Optimistically update UI
      setMessages(prev => prev.filter(m => m.id !== messageId));
      
      toast({
        title: 'Success',
        description: 'Message deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      // Refresh messages if delete failed
      await loadMessages();
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    // Check permissions based on ticket ownership instead of file ownership
    if (userRole !== 'admin' && userRole !== 'support') {
      const { data: ticket } = await supabase
        .from('tickets')
        .select('customer_id')
        .eq('id', ticketId)
        .single();

      if (!ticket || ticket.customer_id !== userId) {
        toast({
          title: 'Permission Denied',
          description: 'You can only delete files from your own tickets',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) {
      toast({
        title: 'Error',
        description: 'File not found',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([fileToDelete.filename]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .match({ id: fileId, ticket_id: ticketId });

      if (dbError) throw dbError;

      await fetchFiles();
      if (files.length <= 1) onClose();

      toast({
        title: 'Success',
        description: 'File deleted',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      await fetchFiles();
    }
  };

  return (
    <Box height="100%" display="flex" flexDirection="column">
      <Box flex="1" overflowY="auto" p={4} bg="gray.50">
        <VStack spacing={4} align="stretch" pt={2}>
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.user_id === currentUserId ? 'flex-end' : 'flex-start'}
              maxWidth={{ base: "85%", md: "50%" }}
              minWidth="auto"
              w="fit-content"
              ml={message.user_id === currentUserId ? 'auto' : '0'}
              mr={message.user_id === currentUserId ? '0' : 'auto'}
              bg={message.is_internal 
                ? 'yellow.100'
                : message.user_id === currentUserId 
                  ? 'green.100' 
                  : 'blue.100'
              }
              p={4}
              borderRadius="lg"
              boxShadow="sm"
              borderLeft={message.is_internal ? '4px solid orange' : undefined}
            >
              <Flex justify="space-between" align="center" mb={2}>
                <Flex align="center" gap={2}>
                  <Text fontWeight="bold">{message.user.full_name}</Text>
                  <Badge colorScheme={message.is_internal ? 'purple' : 'blue'}>
                    {message.is_internal ? 'Internal' : message.user.role}
                  </Badge>
                </Flex>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FiMoreVertical />}
                    variant="ghost"
                    size="sm"
                  />
                  <MenuList>
                    <MenuItem
                      icon={<FiTrash2 />}
                      onClick={() => handleDeleteMessage(message.id, message.user_id)}
                      isDisabled={
                        userRole !== 'admin' &&
                        userRole !== 'support' &&
                        userId !== message.user_id
                      }
                    >
                      Delete Message
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Flex>
              <Box>
                <Text 
                  whiteSpace="pre-wrap" 
                  textAlign="left"
                  wordBreak="break-word"
                >
                  {message.message}
                </Text>
              </Box>
              {message.is_internal && (
                <Badge colorScheme="orange" mt={2}>Internal Note</Badge>
              )}
              <Text fontSize="sm" color="gray.500" mt={2}>
                {new Date(message.created_at).toLocaleString()}
              </Text>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>
      <Box p={4} bg="white" borderTop="1px" borderColor="gray.200">
        <VStack spacing={2}>
          <HStack width="100%" spacing={2} justify="space-between">
            <HStack spacing={2}>
              {isSupport && (
                <FormControl display="flex" alignItems="center" width="auto">
                  <FormLabel htmlFor="internal-note" mb="0" fontSize="sm">
                    Internal Note
                  </FormLabel>
                  <Switch
                    id="internal-note"
                    isChecked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                </FormControl>
              )}
              <FormControl display="flex" alignItems="center" width="auto">
                <FormLabel htmlFor="rag-query" mb="0" fontSize="sm">
                  Search Documents
                </FormLabel>
                <Switch
                  id="rag-query"
                  isChecked={isRagQuery}
                  onChange={(e) => setIsRagQuery(e.target.checked)}
                />
              </FormControl>
            </HStack>
            {files.length > 0 && (
              <Tooltip label="View attached files">
                <Button
                  leftIcon={<FiFile />}
                  variant="ghost"
                  size="sm"
                  onClick={onOpen}
                >
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </Button>
              </Tooltip>
            )}
          </HStack>
          <HStack width="100%" spacing={2}>
            <InputGroup>
              <Input
                placeholder={isRagQuery ? "Ask a question about the documents..." : "Type a message..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <InputRightElement>
                <IconButton
                  aria-label="Upload document"
                  icon={<FiPaperclip />}
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isLoading}
                />
              </InputRightElement>
            </InputGroup>
            <Button
              colorScheme="blue"
              onClick={handleSendMessage}
              isLoading={isLoading}
              leftIcon={isRagQuery ? <FiSearch /> : undefined}
            >
              {isRagQuery ? 'Search' : 'Send'}
            </Button>
          </HStack>
        </VStack>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".txt,.pdf"
          onChange={handleFileUpload}
        />
      </Box>

      {/* Files Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Attached Files</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack align="stretch" spacing={2}>
              {files.map((file) => (
                <Flex
                  key={file.id}
                  p={3}
                  bg="gray.50"
                  borderRadius="md"
                  justify="space-between"
                  align="center"
                >
                  <HStack spacing={3}>
                    <FiFile />
                    <Text>{file.filename.split('/').pop()}</Text>
                  </HStack>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<FiMoreVertical />}
                      variant="ghost"
                      size="sm"
                    />
                    <MenuList>
                      <MenuItem
                        icon={<FiTrash2 />}
                        onClick={() => {
                          handleDeleteFile(file.id);
                          if (files.length <= 1) onClose();
                        }}
                        isDisabled={
                          userRole !== 'admin' && 
                          userRole !== 'support' && 
                          !isTicketOwner
                        }
                      >
                        Delete File
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Flex>
              ))}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
} 
