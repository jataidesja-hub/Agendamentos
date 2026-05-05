import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

  try {
    const body = await req.json();
    const { to, cc, subject, html, pdf_url } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltam campos obrigatórios (to, subject, html)' }, { status: 400 });
    }

    const toList = to.split(',').map((e: string) => e.trim()).filter(Boolean);
    const ccList = cc ? cc.split(',').map((e: string) => e.trim()).filter(Boolean) : [];

    // Busca e prepara o PDF como anexo quando fornecido
    let attachments: { filename: string; content: Buffer }[] = [];
    if (pdf_url) {
      try {
        const pdfRes = await fetch(pdf_url);
        if (pdfRes.ok) {
          const pdfBuffer = await pdfRes.arrayBuffer();
          const rawName = pdf_url.split('/').pop()?.split('?')[0] || 'orcamento.pdf';
          const filename = decodeURIComponent(rawName);
          attachments = [{ filename, content: Buffer.from(pdfBuffer) }];
        }
      } catch (e) {
        console.error('Erro ao buscar PDF para anexo:', e);
        // Continua sem o anexo em vez de abortar o envio
      }
    }

    const results = await Promise.all(
      toList.map(async (recipient: string) => {
        return await resend.emails.send({
          from: 'Sistema CYMI <onboarding@resend.dev>',
          to: recipient,
          cc: ccList.length > 0 ? ccList : undefined,
          subject,
          html,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      })
    );

    const errors = results.filter(r => r.error);
    if (errors.length === toList.length) {
      return NextResponse.json({ error: errors[0].error?.message || 'Todos os envios falharam' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sent: toList.length - errors.length,
      total: toList.length,
      hasAttachment: attachments.length > 0,
    });
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json({ error: 'Erro interno ao tentar enviar e-mail' }, { status: 500 });
  }
}
