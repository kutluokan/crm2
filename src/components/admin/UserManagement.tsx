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
  Text,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface Profile {
  id: string
  role: string
  full_name: string | null
  created_at: string
}

interface AuthUser {
  id: string
  email: string
}

interface User {
  id: string
  email: string
  role: string
  created_at: string
  full_name: string | null
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get all users using rpc
      const { data: authUsers, error: usersError } = await supabase
        .rpc('get_users', {});

      if (usersError) throw usersError;

      // Combine the data
      const usersMap = new Map(authUsers.map((user: AuthUser) => [user.id, user.email]));
      
      setUsers(profiles.map(profile => ({
        ...profile,
        email: usersMap.get(profile.id) || 'N/A'
      })));
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

  async function deleteUser(userId: string) {
    try {
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // First delete all tickets associated with the user
      const { error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .delete()
        .or(`customer_id.eq.${userId},assigned_to.eq.${userId}`);

      if (ticketsError) {
        console.error('Error deleting tickets:', ticketsError);
        throw ticketsError;
      }

      // Then delete the profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Finally delete the user
      const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (userError) throw userError;

      setUsers(users.filter(user => user.id !== userId));

      toast({
        title: 'User deleted successfully',
        description: 'User and all associated data have been removed',
        status: 'success',
        duration: 2000,
      });

      // If the deleted user is the current user, sign out
      if (currentUserId === userId) {
        navigate('/')
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error deleting user',
        description: error.message || 'Make sure you have admin privileges and the user has no active tickets.',
        status: 'error',
        duration: 3000,
      });
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

  if (loading) {
    return <Text p={6}>Loading users...</Text>
  }

  return (
    <Box p={6}>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Email</Th>
            <Th>Display Name</Th>
            <Th>Role</Th>
            <Th>Created At</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map(user => (
            <Tr key={user.id}>
              <Td>{user.email}</Td>
              <Td>{user.full_name || 'N/A'}</Td>
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
              <Td>{new Date(user.created_at).toLocaleDateString()}</Td>
              <Td>
                <Button
                  colorScheme="red"
                  size="sm"
                  onClick={() => deleteUser(user.id)}
                >
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  )
} 