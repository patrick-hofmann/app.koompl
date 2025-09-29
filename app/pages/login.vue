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
      <p class="mt-2 text-center text-sm text-gray-600">
        Access your team's Koompls and data
      </p>
    </div>
    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <UAlert
            v-if="error"
            icon="i-lucide-alert-circle"
            title="Authentication Error"
            :description="error"
            color="red"
            variant="soft"
          />

          <div>
            <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
              Email address
            </label>
            <div class="mt-2">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Enter your email"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium leading-6 text-gray-900">
              Password
            </label>
            <div class="mt-2">
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
                class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Enter your password"
              >
            </div>
          </div>

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

        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300" />
            </div>
            <div class="relative flex justify-center text-sm font-medium leading-6">
              <span class="bg-white px-6 text-gray-900">Test Accounts</span>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-3">
            <div class="bg-gray-50 p-3 rounded-md">
              <p class="text-xs text-gray-600">test1@delta-mind.at / password1 (Team 1 Admin)</p>
            </div>
            <div class="bg-gray-50 p-3 rounded-md">
              <p class="text-xs text-gray-600">test2@delta-mind.at / password2 (Team 2 Admin)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
