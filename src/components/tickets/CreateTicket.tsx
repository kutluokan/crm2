import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'

interface CreateTicketProps {
  onSuccess?: () => void
}

export function CreateTicket({ onSuccess }: CreateTicketProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    getCurrentUser()
  }, [])

  async function getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!userId) {
      toast({
        title: 'Error creating ticket',
        description: 'User not authenticated',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('tickets')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            priority,
            customer_id: userId,
          }
        ])

      if (error) throw error

      toast({
        title: 'Ticket created successfully',
        status: 'success',
        duration: 3000,
      })

      // Reset form
      setTitle('')
      setDescription('')
      setPriority('medium')

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast({
        title: 'Error creating ticket',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack spacing={4}>
        <FormControl isRequired>
          <FormLabel>Title</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the issue"
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed explanation of your issue"
            rows={6}
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

        <Button
          type="submit"
          colorScheme="blue"
          width="full"
          isLoading={loading}
          loadingText="Creating..."
          isDisabled={!userId}
        >
          Create Ticket
        </Button>
      </VStack>
    </Box>
  )
} 