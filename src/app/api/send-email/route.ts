import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

  try {
    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios (to, subject, html)' }, { status: 400 });
    }

    const emailList = to.split(',').map((e: string) => e.trim()).filter(Boolean);

    // Na camada gratuita (onboarding), o Resend pode falhar ao enviar para múltiplos endereços em um único array
    // Se houver mais de um, enviamos de forma individual para maximizar a entrega nos endereços verificados
    const results = await Promise.all(
      emailList.map(async (recipient: string) => {
        return await resend.emails.send({
          from: 'Sistema CYMI <onboarding@resend.dev>',
          to: recipient,
          subject: subject,
          html: html,
        });
      })
    );

    // Verifica se houve erro em algum envio
    const errors = results.filter(r => r.error);
    if (errors.length === emailList.length) {
      // Se TODOS derem erro
      return NextResponse.json({ error: errors[0].error?.message || 'Todos os envios falharam' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      sent: emailList.length - errors.length, 
      total: emailList.length 
    });
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json({ error: 'Erro interno ao tentar enviar e-mail' }, { status: 500 });
  }
}
