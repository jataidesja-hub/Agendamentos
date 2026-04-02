import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios (to, subject, html)' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'Sistema CYMI <onboarding@resend.dev>', // onboarding@resend.dev funciona na camada gratuita com e-mails verificados na conta
      to: [to],
      subject: subject,
      html: html,
    });

    if (data.error) {
      console.error(data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json({ error: 'Erro interno ao tentar enviar e-mail' }, { status: 500 });
  }
}
