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

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role, full_name, created_at')
        .order('created_at', { ascending: false })
        .returns<Profile[]>();

      if (profilesError) throw profilesError;

      // Then get all users using rpc
      const { data: authUsers, error: usersError } = await supabase
        .rpc('get_users', {})
        .returns<AuthUser[]>();

      if (usersError) throw usersError;
      if (!profiles || !authUsers) return;

      // Combine the data
      const usersMap = new Map(authUsers.map((user: AuthUser) => [user.id, user.email]));
      
      const mappedUsers = profiles.map((profile) => {
        const email = usersMap.get(profile.id);
        if (!email) return null;
        
        return {
          id: profile.id,
          email: email,
          role: profile.role,
          created_at: profile.created_at,
          full_name: profile.full_name
        } as User;
      }).filter((user): user is User => user !== null);
      
      setUsers(mappedUsers);
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

      // First delete the profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Then delete the user
      const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (userError) throw userError;

      setUsers(users.filter(user => user.id !== userId));

      toast({
        title: 'User deleted successfully',
        status: 'success',
        duration: 2000,
      });

      // If the deleted user is the current user, sign out
      if (currentUserId === userId) {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error deleting user',
        description: 'Make sure you have admin privileges.',
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

  return (
    <Box p={6}>
      <Heading size="md" mb={4}>User Management</Heading>
      {loading ? (
        <Text>Loading users...</Text>
      ) : (
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
      )}
    </Box>
  )
} 