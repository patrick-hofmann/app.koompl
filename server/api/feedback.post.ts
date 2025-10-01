export default defineEventHandler(async event => {
  try {
    const config = useRuntimeConfig()
    const apiKey = config?.mailgun?.key
    const feedbackEmail = config?.feedback?.email
    const sender = config?.feedback?.sender

    console.log('Mailgun Key:', apiKey)
    console.log('Runtime config result:', { hasMailgunKey: !!apiKey, mailgunKeyLength: apiKey?.length })
    console.log('Feedback Email:', feedbackEmail)

    if (!apiKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Mailgun API key is not configured. Please set MAILGUN_KEY environment variable.'
      })
    }

    const body = await readBody(event)
    const { subject, message, category, user } = body

    if (!subject || !message || !category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Subject, message, and category are required'
      })
    }

    // Extract the domain from the 'from' email address
    const fromAddress = sender
    const domain = fromAddress.split('@')[1] || 'koompl.com'

    // Format the email content
    const emailSubject = `[${category.toUpperCase()}] ${subject}`

    const emailText = `
New Feedback Submission

Category: ${category.charAt(0).toUpperCase() + category.slice(1)}
Subject: ${subject}

Message:
${message}

---
User Information:
Name: ${user?.name || 'Not provided'}
Email: ${user?.email || 'Not provided'}
User ID: ${user?.id || 'Not provided'}
Team: ${user?.teamName || 'Not provided'} (ID: ${user?.teamId || 'Not provided'})

Submitted at: ${new Date().toISOString()}
`

    const form = new URLSearchParams()
    form.set('to', feedbackEmail)
    form.set('subject', emailSubject)
    form.set('text', emailText)
    form.set('from', `Koompl Feedback <${fromAddress}>`)

    // Disable tracking to avoid link-wrapping which can look suspicious
    form.set('o:tracking', 'no')
    form.set('o:tracking-clicks', 'no')
    form.set('o:tracking-opens', 'no')
    form.set('h:Content-Type', 'text/plain; charset=utf-8')
    form.set('h:MIME-Version', '1.0')
    form.set('h:Content-Transfer-Encoding', '8bit')

    // Send via Mailgun using shared helper
    try {
      const { sendMailgunMessage } = await import('../utils/mailgunHelpers')
      const res: { id?: string; message?: string } = await sendMailgunMessage({
        endpointDomain: domain,
        apiKey,
        from: `Koompl Feedback <${fromAddress}>`,
        to: String(feedbackEmail || ''),
        subject: emailSubject,
        text: emailText,
        tracking: false
      })

      console.log('Mailgun API response:', { id: res?.id, message: res?.message })

      return {
        success: true,
        messageId: res?.id,
        message: 'Feedback sent successfully'
      }
    } catch (error: unknown) {
      console.error('Mailgun API error:', error)
      const err = error as { status?: number; statusText?: string; message?: string }

      if (err.status === 401) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid Mailgun API key. Please check MAILGUN_KEY environment variable format.'
        })
      }

      throw createError({
        statusCode: 502,
        statusMessage: 'Mailgun API error: ' + (err.message || String(error))
      })
    }
  } catch (error: unknown) {
    console.error('Feedback API error:', error)
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Failed to send feedback'
    })
  }
})
