<script setup lang="ts">
const toast = useToast()
const { session } = await useUserSession()

// Fetch current team domain from API (not from session)
const { data: teamData, refresh: refreshTeam } = await useAsyncData(
  'team-domain',
  () =>
    $fetch<{ teamId: string; teamName: string; teamDescription?: string; domain: string | null }>(
      '/api/team/domain'
    ),
  { server: false, lazy: true }
)

// Get current team info
const currentTeam = computed(() => ({
  id: teamData.value?.teamId || session.value?.team?.id,
  name: teamData.value?.teamName || session.value?.team?.name,
  description: teamData.value?.teamDescription || session.value?.team?.description,
  domain: teamData.value?.domain
}))
const teamDomain = computed(() => teamData.value?.domain || null)

// Validation state
const validating = ref(false)
const validationResult = ref<{
  configured: boolean
  verified: boolean
  state?: string
  details?: any
  error?: string
} | null>(null)

// Check if Mailgun is configured
const hasMailgunKey = ref(true)

// Validate team domain in Mailgun
async function validateDomain() {
  if (!teamDomain.value) {
    toast.add({
      title: 'No domain configured',
      description: 'Please ask your administrator to set a domain for this team.',
      color: 'warning',
      icon: 'i-lucide-alert-triangle'
    })
    return
  }

  validating.value = true
  validationResult.value = null

  try {
    // Fetch all domains from Mailgun
    const res = await $fetch<{
      ok: boolean
      error?: string
      domains: { name: string; state: string; created_at: string }[]
    }>('/api/mailgun/domains')

    if (!res.ok) {
      if (
        res.error?.includes('missing_api_key') ||
        res.error?.includes('Missing Mailgun API key')
      ) {
        hasMailgunKey.value = false
        validationResult.value = {
          configured: false,
          verified: false,
          error: 'Mailgun API key not configured'
        }
      } else {
        validationResult.value = {
          configured: false,
          verified: false,
          error: res.error || 'Failed to fetch Mailgun domains'
        }
      }
      return
    }

    // Check if team domain exists in Mailgun
    const mailgunDomain = res.domains.find(
      (d) => d.name.toLowerCase() === teamDomain.value?.toLowerCase()
    )

    if (mailgunDomain) {
      const isVerified = mailgunDomain.state === 'active' || mailgunDomain.state === 'verified'
      validationResult.value = {
        configured: true,
        verified: isVerified,
        state: mailgunDomain.state,
        details: mailgunDomain
      }

      if (isVerified) {
        toast.add({
          title: 'Domain verified',
          description: `${teamDomain.value} is properly configured in Mailgun!`,
          color: 'success',
          icon: 'i-lucide-check-circle'
        })
      } else {
        toast.add({
          title: 'Domain not verified',
          description: `${teamDomain.value} exists in Mailgun but needs verification.`,
          color: 'warning',
          icon: 'i-lucide-alert-circle'
        })
      }
    } else {
      validationResult.value = {
        configured: false,
        verified: false,
        error: 'Domain not found in Mailgun'
      }
      toast.add({
        title: 'Domain not configured',
        description: `${teamDomain.value} is not set up in Mailgun yet.`,
        color: 'error',
        icon: 'i-lucide-x-circle'
      })
    }
  } catch (e: any) {
    console.error('Validation error:', e)
    const errorMsg = e?.statusMessage || e?.message || 'Failed to validate domain'
    validationResult.value = {
      configured: false,
      verified: false,
      error: errorMsg
    }
    toast.add({
      title: 'Validation failed',
      description: errorMsg,
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  } finally {
    validating.value = false
  }
}

// Watch for teamDomain to be loaded and auto-validate
watch(
  teamDomain,
  (newDomain) => {
    if (newDomain && !validationResult.value) {
      validateDomain()
    }
  },
  { immediate: true }
)
</script>

<template>
  <UDashboardPanel id="domain">
    <template #header>
      <UDashboardNavbar title="Team Domain">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-rotate-cw"
              color="neutral"
              variant="ghost"
              title="Refresh team data"
              @click="refreshTeam"
            />
            <UButton
              v-if="teamDomain"
              icon="i-lucide-refresh-cw"
              label="Re-validate"
              color="neutral"
              variant="outline"
              :loading="validating"
              @click="validateDomain"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- No Domain Set -->
        <UCard v-if="!teamDomain">
          <div class="text-center py-12">
            <div
              class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4"
            >
              <UIcon name="i-lucide-globe" class="w-8 h-8 text-muted" />
            </div>
            <h3 class="text-lg font-semibold text-highlighted mb-2">No domain configured</h3>
            <p class="text-sm text-muted max-w-md mx-auto mb-6">
              Your team doesn't have a domain set up yet. Contact your super administrator to
              configure a domain for your team.
            </p>
            <UAlert
              icon="i-lucide-info"
              color="blue"
              variant="soft"
              title="Why do I need a domain?"
              description="A domain allows your Koompls to have professional email addresses (e.g., chris@yourcompany.com) instead of generic ones."
            />
          </div>
        </UCard>

        <!-- Domain Configured -->
        <template v-else>
          <!-- Domain Status Card -->
          <UCard>
            <div class="space-y-4">
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-3">
                    <h3 class="text-xl font-semibold text-highlighted">{{ teamDomain }}</h3>
                    <UBadge
                      v-if="validationResult"
                      :color="
                        validationResult.verified
                          ? 'green'
                          : validationResult.configured
                            ? 'amber'
                            : 'red'
                      "
                      variant="subtle"
                    >
                      {{
                        validationResult.verified
                          ? 'Verified'
                          : validationResult.configured
                            ? 'Needs Verification'
                            : 'Not Configured'
                      }}
                    </UBadge>
                    <UBadge v-else color="gray" variant="subtle"> Checking... </UBadge>
                  </div>
                  <p class="text-sm text-muted">
                    Team: <strong>{{ currentTeam?.name }}</strong>
                  </p>
                </div>
                <UButton
                  v-if="session?.user?.isSuperAdmin"
                  icon="i-lucide-settings"
                  color="neutral"
                  variant="ghost"
                  to="/admin"
                >
                  Admin Settings
                </UButton>
              </div>

              <!-- Validation Status -->
              <div v-if="validationResult" class="space-y-3">
                <USeparator />

                <!-- Success State -->
                <UAlert
                  v-if="validationResult.verified"
                  icon="i-lucide-check-circle-2"
                  color="green"
                  variant="soft"
                  title="Domain is properly configured!"
                >
                  <template #description>
                    <div class="space-y-2">
                      <p>
                        Your domain <strong>{{ teamDomain }}</strong> is verified in Mailgun and
                        ready to receive emails.
                      </p>
                      <p class="text-xs">
                        Status: <strong>{{ validationResult.state }}</strong>
                      </p>
                    </div>
                  </template>
                </UAlert>

                <!-- Needs Verification -->
                <UAlert
                  v-else-if="validationResult.configured"
                  icon="i-lucide-alert-circle"
                  color="amber"
                  variant="soft"
                  title="Domain needs verification"
                >
                  <template #description>
                    <p>
                      Your domain exists in Mailgun but hasn't been verified yet. Follow the setup
                      instructions below to complete verification.
                    </p>
                    <p class="text-xs mt-2">
                      Status: <strong>{{ validationResult.state }}</strong>
                    </p>
                  </template>
                </UAlert>

                <!-- Not Configured -->
                <UAlert
                  v-else
                  icon="i-lucide-x-circle"
                  color="red"
                  variant="soft"
                  title="Domain not configured in Mailgun"
                >
                  <template #description>
                    <p>
                      Your domain <strong>{{ teamDomain }}</strong> is not set up in Mailgun yet.
                      Follow the setup instructions below to add it.
                    </p>
                    <p v-if="validationResult.error" class="text-xs mt-2">
                      Error: {{ validationResult.error }}
                    </p>
                  </template>
                </UAlert>
              </div>

              <!-- Email Examples -->
              <div>
                <h4 class="text-sm font-medium text-highlighted mb-2">
                  Your Koompls will use these emails:
                </h4>
                <div class="space-y-1 text-sm text-muted">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-mail" class="w-4 h-4" />
                    <code class="text-xs bg-muted px-2 py-1 rounded">chris@{{ teamDomain }}</code>
                  </div>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-mail" class="w-4 h-4" />
                    <code class="text-xs bg-muted px-2 py-1 rounded">cassy@{{ teamDomain }}</code>
                  </div>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-mail" class="w-4 h-4" />
                    <code class="text-xs bg-muted px-2 py-1 rounded">tracy@{{ teamDomain }}</code>
                  </div>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-mail" class="w-4 h-4" />
                    <code class="text-xs bg-muted px-2 py-1 rounded"
                      >your-custom-agent@{{ teamDomain }}</code
                    >
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Setup Instructions -->
          <UCard v-if="!validationResult?.verified">
            <template #header>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-book-open" class="w-5 h-5" />
                  <h3 class="text-base font-semibold">Mailgun Setup Instructions</h3>
                </div>
                <UBadge color="primary" variant="subtle" size="lg">
                  Setup: {{ teamDomain }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-6 prose prose-sm max-w-none dark:prose-invert">
              <!-- Domain Highlight Box -->
              <div class="bg-primary/10 border-2 border-primary rounded-lg p-4 not-prose">
                <div class="flex items-center gap-3">
                  <div
                    class="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground"
                  >
                    <UIcon name="i-lucide-globe" class="w-5 h-5" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs font-medium text-muted mb-1">Your Team Domain</p>
                    <code class="text-lg font-bold text-primary">{{ teamDomain }}</code>
                  </div>
                </div>
                <p class="text-xs text-muted mt-3 mb-0">
                  👆 This is the domain you need to configure in the steps below
                </p>
              </div>
              <!-- Step 1 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    1
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">
                    Create a Mailgun Account
                  </h4>
                </div>
                <p class="text-sm text-muted ml-8">
                  If you don't have one already, sign up at
                  <a
                    href="https://signup.mailgun.com/new/signup"
                    target="_blank"
                    class="text-primary hover:underline"
                  >
                    mailgun.com/signup </a
                  >. Mailgun offers a free tier with 5,000 emails per month.
                </p>
              </div>

              <!-- Step 2 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    2
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">
                    Add Your Domain to Mailgun
                  </h4>
                </div>
                <div class="ml-8 space-y-2">
                  <p class="text-sm text-muted">
                    In the Mailgun dashboard, go to <strong>Sending</strong> →
                    <strong>Domains</strong> → <strong>Add New Domain</strong>
                  </p>
                  <div class="bg-primary/5 rounded-lg p-4 border-2 border-primary/20">
                    <div class="flex items-center gap-2 mb-2">
                      <UIcon name="i-lucide-globe" class="w-4 h-4 text-primary" />
                      <p class="text-xs font-semibold text-primary m-0">Enter your team domain:</p>
                    </div>
                    <code
                      class="text-base font-bold text-primary bg-background px-4 py-3 rounded border border-primary/30 block"
                    >
                      {{ teamDomain }}
                    </code>
                  </div>
                  <UAlert icon="i-lucide-lightbulb" color="blue" variant="soft" size="sm">
                    <template #title>
                      <span class="text-xs font-medium">Tip</span>
                    </template>
                    <template #description>
                      <span class="text-xs">
                        Choose "Send messages from your domain" when asked about the domain type.
                      </span>
                    </template>
                  </UAlert>
                </div>
              </div>

              <!-- Step 3 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    3
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">Configure DNS Records</h4>
                </div>
                <div class="ml-8 space-y-3">
                  <p class="text-sm text-muted">
                    Mailgun will provide you with DNS records to add to your domain. You need to add
                    these records at your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap).
                  </p>
                  <div class="space-y-2">
                    <p class="text-xs font-medium text-highlighted">Required DNS Records:</p>
                    <ul class="text-xs text-muted space-y-1 list-disc list-inside">
                      <li><strong>TXT records</strong> - For domain verification and SPF</li>
                      <li><strong>CNAME records</strong> - For DKIM authentication</li>
                      <li><strong>MX records</strong> - For receiving inbound emails</li>
                    </ul>
                  </div>
                  <UAlert icon="i-lucide-info" color="blue" variant="soft" size="sm">
                    <template #title>
                      <span class="text-xs font-medium">Important</span>
                    </template>
                    <template #description>
                      <span class="text-xs">
                        DNS changes can take up to 48 hours to propagate, but usually complete
                        within a few hours.
                      </span>
                    </template>
                  </UAlert>
                </div>
              </div>

              <!-- Step 4 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    4
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">Set Up Inbound Routing</h4>
                </div>
                <div class="ml-8 space-y-3">
                  <p class="text-sm text-muted">
                    Configure Mailgun to forward incoming emails to your Koompl application.
                  </p>
                  <div class="space-y-2">
                    <p class="text-xs font-medium text-highlighted">In Mailgun dashboard:</p>
                    <ol class="text-xs text-muted space-y-1 list-decimal list-inside ml-2">
                      <li>Go to <strong>Receiving</strong> → <strong>Routes</strong></li>
                      <li>Click <strong>Create Route</strong></li>
                      <li>Set <strong>Expression Type</strong> to "Match Recipient"</li>
                      <li>
                        Set <strong>Recipient</strong> to:
                        <code class="bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold"
                          >.*@{{ teamDomain }}</code
                        >
                      </li>
                      <li>Add action: <strong>Forward</strong></li>
                      <li>
                        Set webhook URL to:
                        <code class="bg-muted px-1 rounded"
                          >https://your-app-url/api/mailgun/inbound</code
                        >
                      </li>
                      <li>
                        Set <strong>Priority</strong> to
                        <code class="bg-muted px-1 rounded">0</code>
                      </li>
                    </ol>
                  </div>
                  <UAlert icon="i-lucide-alert-triangle" color="amber" variant="soft" size="sm">
                    <template #title>
                      <span class="text-xs font-medium">Note</span>
                    </template>
                    <template #description>
                      <span class="text-xs">
                        Replace <code>your-app-url</code> with your actual application URL. This is
                        where Mailgun will send incoming emails.
                      </span>
                    </template>
                  </UAlert>
                </div>
              </div>

              <!-- Step 5 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    5
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">
                    Configure Mailgun API Key
                  </h4>
                </div>
                <div class="ml-8 space-y-2">
                  <p class="text-sm text-muted">
                    Add your Mailgun API key to the application settings.
                  </p>
                  <ol class="text-xs text-muted space-y-1 list-decimal list-inside ml-2">
                    <li>In Mailgun, go to <strong>Settings</strong> → <strong>API Keys</strong></li>
                    <li>Copy your <strong>Private API key</strong></li>
                    <li>
                      In Koompl, go to
                      <a href="/settings/ai" class="text-primary hover:underline"
                        >Team Settings → AI Providers</a
                      >
                    </li>
                    <li>Paste the API key in the Mailgun section</li>
                  </ol>
                </div>
              </div>

              <!-- Step 6 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div
                    class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                  >
                    6
                  </div>
                  <h4 class="text-sm font-semibold text-highlighted m-0">Verify Setup</h4>
                </div>
                <div class="ml-8 space-y-2">
                  <p class="text-sm text-muted">
                    Once DNS records are propagated and routing is configured:
                  </p>
                  <ul class="text-xs text-muted space-y-1 list-disc list-inside ml-2">
                    <li>
                      Wait for Mailgun to verify your domain (check the Domains page in Mailgun)
                    </li>
                    <li>
                      Click the <strong>"Re-validate"</strong> button above to check the status
                    </li>
                    <li>Send a test email to one of your Koompls to confirm it works</li>
                  </ul>
                </div>
              </div>

              <!-- Help Section -->
              <div class="bg-muted/30 rounded-lg p-4 border border-default mt-6">
                <div class="flex items-start gap-3">
                  <UIcon name="i-lucide-help-circle" class="w-5 h-5 text-primary mt-0.5" />
                  <div class="space-y-2">
                    <h5 class="text-sm font-semibold text-highlighted m-0">Need Help?</h5>
                    <p class="text-xs text-muted">
                      For detailed instructions and troubleshooting, visit the
                      <a
                        href="https://documentation.mailgun.com/en/latest/quickstart-sending.html"
                        target="_blank"
                        class="text-primary hover:underline"
                      >
                        Mailgun Documentation
                      </a>
                      or contact your system administrator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Quick Actions -->
          <UCard v-if="validationResult?.verified">
            <template #header>
              <h3 class="text-base font-semibold">Quick Actions</h3>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UButton to="/agents" icon="i-lucide-bot" color="neutral" variant="outline" block>
                Manage Koompls
              </UButton>
              <UButton
                href="https://app.mailgun.com/mg/dashboard"
                target="_blank"
                icon="i-lucide-external-link"
                color="neutral"
                variant="outline"
                block
              >
                Open Mailgun Dashboard
              </UButton>
            </div>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
