import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { dropId } = await req.json()

    if (!dropId) {
      return new Response(JSON.stringify({ error: 'dropId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Fetch drop details
    const { data: drop, error: dropError } = await supabase
      .from('drops')
      .select('*, drop_items(product_id)')
      .eq('id', dropId)
      .single()

    if (dropError || !drop) {
      return new Response(JSON.stringify({ error: 'Drop not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Fetch up to 4 preview items with images
    const productIds = (drop.drop_items || []).map((di: any) => di.product_id)
    let previewItems: any[] = []

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('name, price, size, product_images(storage_path, display_order)')
        .in('id', productIds)
        .eq('available', true)
        .limit(4)
      previewItems = products || []
    }

    // Fetch all subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('drop_subscribers')
      .select('email')

    if (subError) throw subError

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No subscribers to notify' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Build date string
    const dropDate = drop.scheduled_date
      ? new Date(drop.scheduled_date).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : null

    // Build item preview HTML
    const itemPreviewHtml = previewItems.length > 0
      ? previewItems.map(item => {
          const price = parseFloat(item.price) || 0
          const images = (item.product_images || [])
            .sort((a: any, b: any) => a.display_order - b.display_order)
          const imgUrl = images[0]?.storage_path || null

          return `
            <td style="width:25%;padding:8px;vertical-align:top;text-align:center;">
              ${imgUrl
                ? `<img src="${imgUrl}" width="120" height="120" style="object-fit:cover;border-radius:8px;border:2px solid #e8e6e1;display:block;margin:0 auto;" alt="${item.name}">`
                : `<div style="width:120px;height:120px;background:#f0ebe4;border-radius:8px;margin:0 auto;"></div>`}
              <p style="font-size:13px;font-weight:600;color:#222;margin:8px 0 2px;line-height:1.3;">${item.name}</p>
              <p style="font-size:14px;font-weight:700;color:#cc5500;margin:0;">$${price.toFixed(2)}</p>
            </td>`
        }).join('')
      : `<td style="padding:16px;color:#666;text-align:center;" colspan="4">Items will be revealed at drop time!</td>`

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f1ec;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ec;padding:24px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

                  <!-- Header -->
                  <tr>
                    <td style="background-color:#630031;padding:28px 32px;text-align:center;border-bottom:4px solid #cc5500;">
                      <h1 style="margin:0;font-size:28px;color:#ffffff;letter-spacing:2px;font-family:Georgia,serif;">HOKIES THRIFT</h1>
                      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Drop Notification</p>
                    </td>
                  </tr>

                  <!-- Drop Alert Badge -->
                  <tr>
                    <td style="background-color:#cc5500;padding:14px 32px;text-align:center;">
                      <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🔥 New Drop Alert</p>
                    </td>
                  </tr>

                  <!-- Drop Name + Date -->
                  <tr>
                    <td style="padding:36px 32px 24px;text-align:center;border-bottom:1px solid #f0ebe4;">
                      <h2 style="margin:0 0 12px;font-size:26px;color:#630031;font-family:Georgia,serif;">${drop.name}</h2>
                      ${drop.description ? `<p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">${drop.description}</p>` : ''}
                      ${dropDate ? `
                        <div style="display:inline-block;background:#f7f3ee;border:2px solid #cc5500;border-radius:8px;padding:12px 24px;margin-top:8px;">
                          <p style="margin:0;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Dropping</p>
                          <p style="margin:4px 0 0;font-size:17px;font-weight:700;color:#630031;">${dropDate}</p>
                        </div>` : ''}
                    </td>
                  </tr>

                  <!-- Item Previews -->
                  ${previewItems.length > 0 ? `
                  <tr>
                    <td style="padding:28px 32px 20px;">
                      <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;">Preview Items</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>${itemPreviewHtml}</tr>
                      </table>
                    </td>
                  </tr>` : ''}

                  <!-- CTA Button -->
                  <tr>
                    <td style="padding:24px 32px 36px;text-align:center;">
                      <a href="https://hokiesthrift.com/#shop"
                         style="display:inline-block;background-color:#cc5500;color:#ffffff;padding:16px 40px;border-radius:4px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                        Shop the Drop →
                      </a>
                      <p style="margin:20px 0 0;font-size:13px;color:#888;">Items sell fast — don't miss out!</p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#f7f3ee;padding:20px 32px;text-align:center;border-top:1px solid #e8e4df;">
                      <p style="margin:0;font-size:12px;color:#aaa;">Go Hokies! 🦃 &nbsp;·&nbsp; © ${new Date().getFullYear()} Hokies Thrift</p>
                      <p style="margin:6px 0 0;font-size:11px;color:#bbb;">You're receiving this because you signed up for drop notifications at hokiesthrift.com</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>`

    // Send in batches of 100 via Resend batch API
    const emails = subscribers.map((s: any) => s.email)
    let sent = 0
    let failed = 0

    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100)
      const batch = chunk.map((email: string) => ({
        from: 'Hokies Thrift <drops@hokiesthrift.com>',
        to: [email],
        subject: `🔥 Drop Alert: ${drop.name}${dropDate ? ' — ' + dropDate : ''}`,
        html: emailHtml,
      }))

      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(batch),
      })

      if (res.ok) {
        sent += chunk.length
      } else {
        const errData = await res.json()
        console.error('Resend batch error:', errData)
        failed += chunk.length
      }
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error: any) {
    console.error('Error in send-drop-notification:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
