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
  Text,
  Flex,
} from '@chakra-ui/react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { FiUsers, FiInbox } from 'react-icons/fi'
import { TicketList } from './tickets/TicketList'

interface AuthUser {
  id: string
  email: string
}

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

const sidebarItems = [
  { label: 'User Management', path: '/admin/users', icon: FiUsers },
  { label: 'Tickets', path: '/admin/tickets', icon: FiInbox },
]

export function AdminDashboard() {
  const location = useLocation()
  const isTicketsPath = location.pathname.includes('/tickets')
  const isUsersPath = location.pathname.includes('/users')

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
        await handleSignOut();
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

  async function handleSignOut() {
    try {
      // Clear any stored sessions
      sessionStorage.clear()
      localStorage.clear()
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Force a page reload to clear all state
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      // Force reload anyway on error
      window.location.href = '/'
    }
  }

  return (
    <Flex>
      <Sidebar items={sidebarItems} />
      <Box ml="240px" w="calc(100% - 240px)" minH="100vh" bg="gray.50">
        <Container maxW="container.xl" py={8}>
          <HStack justify="space-between" mb={8}>
            <Heading size="lg">Admin Dashboard</Heading>
            <Button onClick={handleSignOut} colorScheme="red" variant="outline">
              Sign Out
            </Button>
          </HStack>

          <Box bg="white" rounded="lg" shadow="base" overflow="hidden">
            {isTicketsPath ? (
              <TicketList userRole="admin" />
            ) : isUsersPath ? (
              <Outlet />
            ) : (
              <Navigate to="users" replace />
            )}
          </Box>
        </Container>
      </Box>
    </Flex>
  )
}
