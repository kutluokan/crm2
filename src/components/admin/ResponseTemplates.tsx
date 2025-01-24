import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  HStack,
  Select,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Text,
} from '@chakra-ui/react'
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi'
import { supabase } from '../../lib/supabase'

interface Template {
  id: string
  title: string
  content: string
  category: string
  is_global: boolean
  created_by: string
  created_at: string
}

interface ResponseTemplatesProps {
  userRole: 'admin' | 'support'
  userId: string
}

export function ResponseTemplates({ userRole, userId }: ResponseTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [currentTemplate, setCurrentTemplate] = useState<Partial<Template>>({})
  const [loading, setLoading] = useState(true)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  useEffect(() => {
    if (userId) {
      fetchTemplates()
    }
  }, [userRole, userId])

  async function fetchTemplates() {
    try {
      let query = supabase
        .from('response_templates')
        .select('*')

      // Support users can only see their own templates and global templates
      if (userRole === 'support') {
        query = query.or(`created_by.eq.${userId},is_global.is.true`)
      }

      const { data, error } = await query.order('category').order('title')

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast({
        title: 'Error fetching templates',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const template = {
        ...currentTemplate,
        created_by: userId,
        is_global: userRole === 'admin' ? currentTemplate.is_global : false,
      }

      const { error } = currentTemplate.id
        ? await supabase
            .from('response_templates')
            .update(template)
            .eq('id', currentTemplate.id)
        : await supabase
            .from('response_templates')
            .insert([template])

      if (error) throw error

      toast({
        title: `Template ${currentTemplate.id ? 'updated' : 'created'} successfully`,
        status: 'success',
        duration: 2000,
      })

      onClose()
      fetchTemplates()
      setCurrentTemplate({})
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: 'Error saving template',
        description: error instanceof Error ? error.message : 'An error occurred',
        status: 'error',
        duration: 3000,
      })
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this template?')) return

    try {
      const { error } = await supabase
        .from('response_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Template deleted successfully',
        status: 'success',
        duration: 2000,
      })

      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: 'Error deleting template',
        status: 'error',
        duration: 3000,
      })
    }
  }

  function handleEdit(template: Template) {
    setCurrentTemplate(template)
    onOpen()
  }

  return (
    <Box p={6}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Response Templates</Text>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          onClick={() => {
            setCurrentTemplate({})
            onOpen()
          }}
        >
          Add Template
        </Button>
      </HStack>

      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Title</Th>
            <Th>Category</Th>
            <Th>Global</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {templates.map(template => (
            <Tr key={template.id}>
              <Td>{template.title}</Td>
              <Td>{template.category}</Td>
              <Td>
                {template.is_global && (
                  <Badge colorScheme="green">Global</Badge>
                )}
              </Td>
              <Td>
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Edit template"
                    icon={<FiEdit2 />}
                    size="sm"
                    onClick={() => handleEdit(template)}
                  />
                  {(userRole === 'admin' || template.created_by === userId) && (
                    <IconButton
                      aria-label="Delete template"
                      icon={<FiTrash2 />}
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleDelete(template.id)}
                    />
                  )}
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {currentTemplate.id ? 'Edit Template' : 'New Template'}
          </ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Title</FormLabel>
                  <Input
                    value={currentTemplate.title || ''}
                    onChange={(e) => setCurrentTemplate(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Template title"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={currentTemplate.category || ''}
                    onChange={(e) => setCurrentTemplate(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Select category"
                  >
                    <option value="greeting">Greeting</option>
                    <option value="troubleshooting">Troubleshooting</option>
                    <option value="closing">Closing</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="other">Other</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Content</FormLabel>
                  <Textarea
                    value={currentTemplate.content || ''}
                    onChange={(e) => setCurrentTemplate(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Template content"
                    rows={6}
                  />
                </FormControl>

                {userRole === 'admin' && (
                  <FormControl>
                    <FormLabel>Global Template</FormLabel>
                    <Select
                      value={currentTemplate.is_global ? 'true' : 'false'}
                      onChange={(e) => setCurrentTemplate(prev => ({ ...prev, is_global: e.target.value === 'true' }))}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  </FormControl>
                )}
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" type="submit">
                Save
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </Box>
  )
} 