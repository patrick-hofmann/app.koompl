declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    role: 'admin' | 'user'
  }

  interface UserSession {
    team?: {
      id: string
      name: string
      description: string
    }
    availableTeams?: Array<{
      id: string
      name: string
      description: string
      role: 'admin' | 'user'
    }>
    loggedInAt?: string
  }

  interface SecureSessionData {
    // Add any secure session data here if needed
  }
}

export {}
