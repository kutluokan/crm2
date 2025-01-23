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

  const handleAnonymousSignIn = async () => {
    try {
      console.log('Starting anonymous admin sign in...')
      
      // Generate a random email and password for anonymous users
      const randomId = Math.random().toString(36).substring(2)
      const email = `anonymous_admin_${randomId}@temp.com`
      const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
      const displayName = `Anonymous Admin ${randomId.substring(0, 4)}`
      
      console.log('Generated credentials:', { email })
      
      // First sign up the user
      console.log('Attempting to sign up...')
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'admin',
            full_name: displayName
          }
        }
      })

      if (signUpError) {
        console.error('Sign up error:', signUpError)
        throw signUpError
      }

      if (!signUpData.user) {
        throw new Error('No user data returned after signup')
      }

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Then sign in with the credentials
      console.log('Attempting to sign in...')
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError
      
    } catch (error: any) {
      console.error('Error signing in anonymously:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in anonymously',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleAnonymousCustomerSignIn = async () => {
    try {
      const randomId = Math.random().toString(36).substring(2)
      const email = `anonymous_customer_${randomId}@temp.com`
      const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
      const displayName = `Anonymous Customer ${randomId.substring(0, 4)}`
      
      // First sign up the user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'customer',
            full_name: displayName
          }
        }
      })

      if (signUpError) throw signUpError
      
      // Then sign in with the credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError
      
    } catch (error) {
      console.error('Error signing in anonymously as customer:', error)
      toast({
        title: 'Error',
        description: 'Failed to sign in anonymously as customer. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleAnonymousSupportSignIn = async () => {
    try {
      const randomId = Math.random().toString(36).substring(2)
      const email = `anonymous_support_${randomId}@temp.com`
      const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
      const displayName = `Anonymous Support ${randomId.substring(0, 4)}`
      
      // First sign up the user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'support',
            full_name: displayName
          }
        }
      })

      if (signUpError) throw signUpError
      
      // Then sign in with the credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError
      
    } catch (error) {
      console.error('Error signing in anonymously as support:', error)
      toast({
        title: 'Error',
        description: 'Failed to sign in anonymously as support. Please try again.',
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
          onClick={handleAnonymousSignIn}
          size="lg"
        >
          Continue as Admin
        </Button>

        <Button 
          colorScheme="purple" 
          width="100%" 
          onClick={handleAnonymousSupportSignIn}
          size="lg"
        >
          Continue as Support
        </Button>
        
        <Button 
          colorScheme="green" 
          width="100%" 
          onClick={handleAnonymousCustomerSignIn}
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
