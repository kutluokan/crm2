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

  const handleAnonymousSignIn = async () => {
    try {
      // Generate a random email and password for anonymous users
      const randomId = Math.random().toString(36).substring(2)
      const email = `anonymous_${randomId}@temp.com`
      const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'admin'
          }
        }
      })

      if (error) throw error
      console.log('Anonymous sign in successful:', data)
      
      // Store credentials in session storage in case we need them later
      sessionStorage.setItem('anonymousCredentials', JSON.stringify({ email, password }))
      
    } catch (error) {
      console.error('Error signing in anonymously:', error)
      toast({
        title: 'Error',
        description: 'Failed to sign in anonymously. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  return (
    <Box bg="white" p={8} rounded="lg" shadow="base">
      <VStack spacing={6}>
        <Heading size="lg" textAlign="center">Welcome to CRM</Heading>
        
        <Button 
          colorScheme="blue" 
          width="100%" 
          onClick={handleAnonymousSignIn}
          size="lg"
        >
          Continue as Admin (Anonymous)
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
