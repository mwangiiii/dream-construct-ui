// src/app/api/sendMail/route.ts
// OR: src/pages/api/sendMail.ts (if using Pages Router)
// Modern, type-safe Vercel API route with Nodemailer (2025 best practices)

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// POST handler (Vercel uses edge or serverless – this works in both)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, subService, category, stage } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, subject, or message' },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Optional: improve deliverability
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Enhanced email body with better formatting
    const textBody = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Service Details:
• Sub-Service: ${subService || 'Not specified'}
• Category: ${category || 'Not specified'}
• Project Stage: ${stage || 'Not specified'}

Message:
${message}

---
Sent from your website contact form
    `.trim();

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #1a56db;">New Contact Form Submission</h2>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        
        ${subService || category || stage ? `
        <h3 style="color: #1a56db; margin-top: 24px;">Service Details</h3>
        <ul>
          ${subService ? `<li><strong>Sub-Service:</strong> ${subService}</li>` : ''}
          ${category ? `<li><strong>Category:</strong> ${category}</li>` : ''}
          ${stage ? `<li><strong>Project Stage:</strong> ${stage}</li>` : ''}
        </ul>
        ` : ''}

        <h3 style="color: #1a56db; margin-top: 24px;">Message</h3>
        <p style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
        
        <hr style="border: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="color: #6b7280; font-size: 12px;">Sent from your website contact form</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_RECEIVER || process.env.SMTP_USER,
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      text: textBody,
      html: htmlBody,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

// Optional: Block non-POST methods cleanly
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}