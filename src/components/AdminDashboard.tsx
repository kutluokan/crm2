import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Select,
  Button,
  useToast,
  HStack,
  Text
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

export function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          role,
          created_at,
          email:auth.users(email)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setUsers(profiles.map(profile => ({
        ...profile,
        email: profile.email?.[0]?.email || 'N/A'
      })))
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error fetching users',
        status: 'error',
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))

      toast({
        title: 'Role updated successfully',
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Error updating role:', error)
      toast({
        title: 'Error updating role',
        status: 'error',
        duration: 3000,
      })
    }
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out:', error)
      toast({
        title: 'Error signing out',
        status: 'error',
        duration: 3000,
      })
    }
  }

  return (
    <Container maxW="container.xl" py={8}>
      <HStack justify="space-between" mb={8}>
        <Heading size="lg">Admin Dashboard</Heading>
        <Button onClick={handleSignOut} colorScheme="red" variant="outline">
          Sign Out
        </Button>
      </HStack>

      <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
        <Box p={6}>
          <Heading size="md" mb={4}>User Management</Heading>
          {loading ? (
            <Text>Loading users...</Text>
          ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Created At</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map(user => (
                  <Tr key={user.id}>
                    <Td>{user.email}</Td>
                    <Td>{user.role}</Td>
                    <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
                    <Td>
                      <Select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        maxW="200px"
                      >
                        <option value="customer">Customer</option>
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      </Box>
    </Container>
  )
}
