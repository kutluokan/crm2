import { Auth as SupabaseAuth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Box, Button, Heading, VStack, Divider, useToast } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { AuthChangeEvent } from '@supabase/supabase-js'
import { useEffect } from 'react'

export function Auth() {
  const toast = useToast()

  useEffect(() => {
    console.log('Auth component mounted')
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
    // Check if we have the key (don't log the actual key)
    console.log('Supabase key available:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'SIGNED_OUT') {
        console.log('User signed out')
      } else if (event === 'SIGNED_IN') {
        console.log('User signed in:', session?.user?.email)
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery requested')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Clear any existing sessions on mount
    sessionStorage.clear()
  }, [])

  const handleAdminSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'adam.admin@example.com',
        password: 'password123'
      })

      if (error) throw error
      
    } catch (error: any) {
      console.error('Error signing in as admin:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in as admin',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleCustomerSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'christina.customer@example.com',
        password: 'password123'
      })

      if (error) throw error
      
    } catch (error: any) {
      console.error('Error signing in as customer:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in as customer',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleSupportSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'sarah.support@example.com',
        password: 'password123'
      })

      if (error) throw error
      
    } catch (error: any) {
      console.error('Error signing in as support:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in as support',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <Box bg="white" p={8} rounded="lg" shadow="base">
      <VStack spacing={6}>
        <Heading size="lg" textAlign="center">Welcome to Auto-CRM</Heading>
        
        <Button 
          colorScheme="blue" 
          width="100%" 
          onClick={handleAdminSignIn}
          size="lg"
        >
          Continue as Admin
        </Button>

        <Button 
          colorScheme="purple" 
          width="100%" 
          onClick={handleSupportSignIn}
          size="lg"
        >
          Continue as Support
        </Button>
        
        <Button 
          colorScheme="green" 
          width="100%" 
          onClick={handleCustomerSignIn}
          size="lg"
        >
          Continue as Customer
        </Button>
        
        <Divider />
        
        <Box width="100%">
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2B6CB0',
                    brandAccent: '#2C5282'
                  }
                }
              },
              style: {
                button: { height: '40px', borderRadius: '6px' },
                anchor: { color: '#2B6CB0' },
                container: { width: '100%', maxWidth: '100%' },
                message: { color: '#2B6CB0' }
              }
            }}
            providers={[]}
            redirectTo={window.location.origin}
            showLinks={true}
            view="sign_in"
          />
        </Box>
      </VStack>
    </Box>
  )
}
