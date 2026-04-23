import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

  try {
    const body = await req.json();
    const { to, cc, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios (to, subject, html)' }, { status: 400 });
    }

    const toList = to.split(',').map((e: string) => e.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];

    const results = await Promise.all(
      toList.map(async (recipient: string) => {
        return await resend.emails.send({
          from: 'Sistema CYMI <onboarding@resend.dev>',
          to: recipient,
          cc: ccList.length > 0 ? ccList : undefined,
          subject,
          html,
        });
      })
    );

    const errors = results.filter(r => r.error);
    if (errors.length === toList.length) {
      return NextResponse.json({ error: errors[0].error?.message || 'Todos os envios falharam' }, { status: 400 });
    }

    return NextResponse.json({ success: true, sent: toList.length - errors.length, total: toList.length });
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json({ error: 'Erro interno ao tentar enviar e-mail' }, { status: 500 });
  }
}
