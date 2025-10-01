<script setup lang="ts">
const router = useRouter()
const { fetch } = await useUserSession()

const email = ref('')
const password = ref('')
const isLoggingIn = ref(false)
const error = ref('')

async function handleLogin() {
  try {
    isLoggingIn.value = true
    error.value = ''

    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    })

    // Refresh the session to get updated user data
    await fetch()

    // Redirect to the main page after successful login
    await router.push('/')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed. Please try again.'
  } finally {
    isLoggingIn.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-bold leading-9 tracking-tight text-gray-900">
        Sign in to your team
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">Access your team's Koompls and data</p>
    </div>
    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleLogin">
          <UAlert
            v-if="error"
            icon="i-lucide-alert-circle"
            title="Authentication Error"
            :description="error"
            color="red"
            variant="soft"
          />

          <UFormField label="Email address">
            <UInput
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="Enter your email"
              required
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              required
            />
          </UFormField>

          <div>
            <UButton
              type="submit"
              :loading="isLoggingIn"
              :disabled="!email || !password"
              size="lg"
              block
              class="w-full flex justify-center"
            >
              {{ isLoggingIn ? 'Signing in...' : 'Sign in' }}
            </UButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
