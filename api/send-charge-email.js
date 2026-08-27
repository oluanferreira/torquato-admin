const nodemailer = require('nodemailer');

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const { to, tenantName, dueDate, amount, property, subject, text } = req.body || {};

  if (!to || !subject || !text) {
    return res.status(400).json({ ok: false, error: 'Destinatário, assunto e mensagem são obrigatórios.' });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;
  const fromName = process.env.SMTP_FROM_NAME || 'Torquato Imóveis';
  const replyTo = process.env.SMTP_REPLY_TO || fromEmail;
  const secure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';

  if (!host || !port || !user || !pass || !fromEmail) {
    return res.status(503).json({ ok: false, error: 'SMTP ainda não configurado na Vercel.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: true }
    });

    await transporter.verify();

    const safeText = esc(text).replaceAll('\n', '<br>');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#152033;line-height:1.6">
        <div style="border-bottom:4px solid #285EA7;padding-bottom:14px;margin-bottom:24px">
          <strong style="font-size:20px;color:#285EA7">Torquato Imóveis</strong>
        </div>
        <div style="font-size:15px">${safeText}</div>
        <div style="margin-top:28px;padding:14px 16px;background:#f4f7fb;border-radius:10px;font-size:13px">
          <strong>Resumo da cobrança</strong><br>
          Locatário: ${esc(tenantName || '')}<br>
          Imóvel: ${esc(property || '')}<br>
          Vencimento: ${esc(dueDate || '')}<br>
          Valor: ${esc(amount || '')}
        </div>
      </div>`;

    const info = await transporter.sendMail({
      from: `"${fromName.replaceAll('"', '')}" <${fromEmail}>`,
      to,
      replyTo,
      subject,
      text,
      html
    });

    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('SMTP charge email error:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível enviar o e-mail de cobrança.' });
  }
};
