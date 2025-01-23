import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  is_internal: boolean;
  user?: {
    full_name: string;
  };
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
  isSupport: boolean;
}

export default function TicketChat({ ticketId, currentUserId, isSupport }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get current user's name
  useEffect(() => {
    async function getCurrentUserName() {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .single();

      if (data?.full_name) {
        setCurrentUserName(data.full_name);
      }
    }
    getCurrentUserName();
  }, [currentUserId]);

  useEffect(() => {
    // Load initial messages
    loadMessages();

    // Set up realtime subscription
    const channel = supabase.channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          console.log('New message received:', payload);
          // Fetch the complete message with user info
          const { data, error } = await supabase
            .from('ticket_messages')
            .select('*, user:profiles(full_name)')
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            setMessages(prev => [...prev, data]);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [ticketId]);

  async function loadMessages() {
    console.log('Loading messages for ticket:', ticketId);
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*, user:profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    console.log('Loaded messages:', data);
    setMessages(data || []);
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    console.log('Sending message:', newMessage);
    const messageToSend = {
      ticket_id: ticketId,
      user_id: currentUserId,
      message: newMessage.trim(),
      is_internal: false,
    };

    const { error } = await supabase
      .from('ticket_messages')
      .insert(messageToSend);

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    console.log('Message sent successfully');
    setNewMessage('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {messages.map((message) => {
            const isCurrentUser = message.user_id === currentUserId;
            const userName = isCurrentUser ? currentUserName : message.user?.full_name || 'Unknown User';
            
            return (
              <div
                key={message.id}
                className={`flex flex-col ${
                  isCurrentUser ? 'items-end' : 'items-start'
                } mb-4 last:mb-0`}
              >
                <span className="text-xs text-gray-500 mb-1 px-2">
                  {userName}
                </span>
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isCurrentUser
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <p className="break-words">{message.message}</p>
                  <span className="text-xs opacity-75 block mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Box */}
      <div className="flex-shrink-0 border-t bg-white p-4">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border p-2"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 whitespace-nowrap"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
} 