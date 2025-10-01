export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, session } = await useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  if (!session.value?.user?.isSuperAdmin) {
    return navigateTo('/')
  }
})
