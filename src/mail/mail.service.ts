import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export type OrderMailPayload = {
  to: string;
  customerName: string;
  orderNumber: string;
  orderTotal: string;
  items: Array<{ name: string; qty: number; price: string }>;
  statusLabel?: string;
  trackingUrl?: string;
  actionUrl?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT') ?? 587;
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.from = config.get<string>('SMTP_FROM') ?? 'OnePrints <noreply@oneprints.in>';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only.');
    }
  }

  private async send(mail: Mail.Options) {
    if (!this.transporter) {
      this.logger.debug(`[MAIL STUB] To: ${String(mail.to)} | Subject: ${String(mail.subject)}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, ...mail });
    } catch (err) {
      this.logger.error(`Failed to send email to ${String(mail.to)}`, err);
    }
  }

  async sendOrderConfirmation(payload: OrderMailPayload) {
    const itemRows = payload.items
      .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9">${i.name}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #f1f5f9">×${i.qty}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #f1f5f9">₹${i.price}</td></tr>`)
      .join('');

    await this.send({
      to: payload.to,
      subject: `Order Confirmed — #${payload.orderNumber}`,
      html: this.baseTemplate({
        title: 'Your order is confirmed!',
        preheader: `Order #${payload.orderNumber} received. We're on it!`,
        body: `
          <p style="margin:0 0 16px">Hi ${payload.customerName},</p>
          <p style="margin:0 0 20px">Thanks for your order! We've received it and it's now being processed.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;font-size:14px">
            <thead><tr><th style="text-align:left;padding:8px 0;border-bottom:2px solid #e2e8f0;color:#64748b">Item</th><th style="text-align:right;padding:8px 0;border-bottom:2px solid #e2e8f0;color:#64748b">Qty</th><th style="text-align:right;padding:8px 0;border-bottom:2px solid #e2e8f0;color:#64748b">Price</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <p style="font-size:16px;font-weight:700;margin:0 0 24px">Total: ₹${payload.orderTotal}</p>
          ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Track your order</a>` : ''}
        `,
      }),
    });
  }

  async sendOrderStatusUpdate(payload: OrderMailPayload) {
    await this.send({
      to: payload.to,
      subject: `Order Update — #${payload.orderNumber}: ${payload.statusLabel ?? 'Status changed'}`,
      html: this.baseTemplate({
        title: `Order status: ${payload.statusLabel ?? 'Updated'}`,
        preheader: `Your order #${payload.orderNumber} has been updated.`,
        body: `
          <p style="margin:0 0 16px">Hi ${payload.customerName},</p>
          <p style="margin:0 0 20px">Your order <strong>#${payload.orderNumber}</strong> status has been updated to <strong>${payload.statusLabel ?? 'Updated'}</strong>.</p>
          ${payload.trackingUrl ? `<p style="margin:0 0 20px">Tracking: <a href="${payload.trackingUrl}">${payload.trackingUrl}</a></p>` : ''}
          ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">View order</a>` : ''}
        `,
      }),
    });
  }

  async sendProofReady(payload: { to: string; customerName: string; orderNumber: string; proofUrl: string; reviewUrl: string }) {
    await this.send({
      to: payload.to,
      subject: `Your proof is ready — Order #${payload.orderNumber}`,
      html: this.baseTemplate({
        title: 'Your design proof is ready',
        preheader: 'Please review and approve your proof to proceed with printing.',
        body: `
          <p style="margin:0 0 16px">Hi ${payload.customerName},</p>
          <p style="margin:0 0 20px">Your design proof for order <strong>#${payload.orderNumber}</strong> is ready for review. Please check it carefully before we proceed to print.</p>
          <a href="${payload.reviewUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-bottom:16px">Review &amp; Approve Proof</a>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Once approved, your order will move to production. Rejecting it will allow you to request changes.</p>
        `,
      }),
    });
  }

  async sendDesignerWelcome(payload: { to: string; name: string; dashboardUrl: string }) {
    await this.send({
      to: payload.to,
      subject: 'Welcome to the OnePrints Designer Network!',
      html: this.baseTemplate({
        title: 'Welcome aboard!',
        preheader: 'Your designer application has been approved.',
        body: `
          <p style="margin:0 0 16px">Hi ${payload.name},</p>
          <p style="margin:0 0 20px">Congratulations! Your application to join the OnePrints Designer Network has been approved. You can now accept design jobs, submit proofs, and earn from every completed order.</p>
          <a href="${payload.dashboardUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700">Go to your dashboard</a>
        `,
      }),
    });
  }

  private baseTemplate({ title, preheader, body }: { title: string; preheader: string; body: string }) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<span style="display:none;max-height:0;overflow:hidden">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800">OnePrints</h1>
  </td></tr>
  <tr><td style="padding:36px 40px">
    <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f172a">${title}</h2>
    ${body}
  </td></tr>
  <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:12px;color:#94a3b8">© ${new Date().getFullYear()} OnePrints. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  }
}
