import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const bodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: z.string().trim().regex(/^[+0-9][0-9\s-]{7,17}$/, 'Invalid mobile number'),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const Route = createFileRoute('/api/public/data-deletion-request')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown
        try {
          json = await request.json()
        } catch {
          return Response.json({ error: 'Invalid request' }, { status: 400 })
        }
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
          return Response.json({ error: 'Please check the details and try again.' }, { status: 400 })
        }
        const { fullName, mobile, email, message } = parsed.data
        const supabase = createClient(
          process.env['SUPABASE_URL']!,
          process.env['SUPABASE_PUBLISHABLE_KEY']!,
          { auth: { persistSession: false } },
        )
        const { error } = await supabase.from('data_deletion_requests').insert({
          full_name: fullName,
          mobile,
          email: email || null,
          message: message || null,
        })
        if (error) {
          console.error('[data-deletion-request]', error)
          return Response.json({ error: 'Could not submit right now. Please email info@radiantguards.com.' }, { status: 500 })
        }
        return Response.json({ ok: true })
      },
    },
  },
})
