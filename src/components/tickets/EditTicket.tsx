import { useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  VStack,
  HStack,
  useToast,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'

interface EditTicketProps {
  ticket: {
    id: string;
    title: string;
    description: string;
    priority: string;
  };
  onClose: () => void;
  onUpdate: () => void;
}

export function EditTicket({ ticket, onClose, onUpdate }: EditTicketProps) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [priority, setPriority] = useState(ticket.priority)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          title,
          description,
          priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id)

      if (error) throw error

      toast({
        title: 'Ticket updated successfully',
        status: 'success',
        duration: 3000,
      })

      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error updating ticket:', error)
      toast({
        title: 'Error updating ticket',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit} p={6}>
      <VStack spacing={4} align="stretch">
        <FormControl isRequired>
          <FormLabel>Title</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of your issue"
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of your issue"
            minH="200px"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Priority</FormLabel>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </FormControl>

        <HStack spacing={4} justify="flex-end">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={loading}
            loadingText="Updating..."
          >
            Update Ticket
          </Button>
        </HStack>
      </VStack>
    </Box>
  )
} 