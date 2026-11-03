import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = env.SMTP_HOST.replace(/['"]/g, '').trim();
  const user = env.SMTP_USER.replace(/['"]/g, '').trim();
  const pass = env.SMTP_PASS.replace(/['"]/g, '').trim();
  const port = env.SMTP_PORT || 587;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendNotificationEmail(options: SendEmailOptions): Promise<void> {
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.log('\n📧 [EMAIL SIMULATION (Configure SMTP in .env for real delivery)]');
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Body:\n${options.text.split('\n').map((l) => '     ' + l).join('\n')}\n`);
    return;
  }

  const fromAddress = env.SMTP_USER
    ? `"Inventory Management System" <${env.SMTP_USER.replace(/['"]/g, '').trim()}>`
    : env.EMAIL_FROM;

  try {
    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`✅ [EMAIL SENT] To: ${options.to} | Subject: "${options.subject}" | MessageID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending to ${options.to}:`, error);
  }
}

// ---------------------------------------------------------------------------
// High-Level notification triggers
// ---------------------------------------------------------------------------

export async function notifyRequestSubmitted(details: {
  to: string;
  requesterName: string;
  requestId: string;
  category: string;
  description: string;
}): Promise<void> {
  const shortId = details.requestId.slice(0, 8);
  const subject = `[Device Request Received] #${shortId} - ${details.category}`;
  const text = `Hello ${details.requesterName},\n\nYour equipment request has been successfully submitted and is awaiting approval by your Team Lead / Admin.\n\nDetails:\n- Request ID: #${shortId}\n- Category: ${details.category}\n- Description: ${details.description}\n\nYou will be notified via email when your request is reviewed.\n\nBest regards,\nIT & Equipment Inventory Team`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="background-color: #0f172a; color: white; padding: 16px; border-radius: 6px; text-align: center;">
    <h2 style="margin: 0; font-size: 20px;">Equipment Request Received</h2>
  </div>
  <div style="padding: 20px 0;">
    <p>Hello <strong>${details.requesterName}</strong>,</p>
    <p>Your equipment request has been successfully submitted and notification has been dispatched to your Team Lead / Admin for approval.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%;">Request ID</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">#${shortId}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Category</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.category}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Details</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.description}</td>
      </tr>
    </table>
    <p style="font-size: 12px; color: #64748b;">You will receive another notification when your request is reviewed.</p>
  </div>
</div>`;

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
    html,
  });
}

export async function notifyTLRequestSubmitted(details: {
  to: string;
  tlName: string;
  requesterName: string;
  requesterEmpCode?: string;
  requesterEmail?: string;
  team: string;
  requestId: string;
  category: string;
  description: string;
}): Promise<void> {
  const shortId = details.requestId.slice(0, 8);
  const subject = `[Action Required] New Device Request from ${details.requesterName} (#${shortId} - ${details.category})`;

  const text = `Hello ${details.tlName},

A new equipment request has been submitted by an employee in your team (${details.team}) and is awaiting your review:

- Requester: ${details.requesterName}${details.requesterEmpCode ? ` (${details.requesterEmpCode})` : ''}
- Team: ${details.team}
- Requester Email: ${details.requesterEmail || 'N/A'}
- Category: ${details.category}
- Details: ${details.description}
- Request ID: #${shortId}

Please review this requisition in the portal:
http://localhost:5173/requests

Best regards,
IT & Equipment Inventory Team`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="background-color: #2563eb; color: white; padding: 16px; border-radius: 6px; text-align: center;">
    <h2 style="margin: 0; font-size: 20px;">Equipment Request Notification</h2>
    <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Action Required by Team Lead</p>
  </div>
  <div style="padding: 20px 0;">
    <p>Hello <strong>${details.tlName}</strong>,</p>
    <p>A new equipment request has been submitted by a member of your team (<strong>${details.team}</strong>) and requires your review.</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 35%;">Requester</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.requesterName} ${details.requesterEmpCode ? `(${details.requesterEmpCode})` : ''}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Team</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.team}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Category</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.category}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Details / Purpose</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${details.description}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Request ID</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">#${shortId}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      <a href="http://localhost:5173/requests" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Review Request in Portal
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
      Best regards,<br>
      IT & Equipment Inventory Team
    </p>
  </div>
</div>`;

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
    html,
  });
}

export async function notifyDeviceAssigned(details: {
  to: string;
  employeeName: string;
  itemName: string;
  itemId: string;
  assignedAt: string;
  notes?: string;
}): Promise<void> {
  const subject = `[Equipment Assigned] ${details.itemName} has been assigned to you`;
  const text = `Hello ${details.employeeName},\n\nThe following equipment has been formally assigned to you in the inventory system:\n\n- Item: ${details.itemName}\n- Identifier (IMEI/Serial): ${details.itemId}\n- Assigned Date: ${details.assignedAt}\n${details.notes ? `- Notes: ${details.notes}\n` : ''}\nPlease ensure proper care and return the device in good working order when no longer needed.\n\nBest regards,\nIT & Equipment Inventory Team`;

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
  });
}

export async function notifyDeviceReturned(details: {
  to: string;
  employeeName: string;
  itemName: string;
  returnedAt: string;
  notes?: string;
}): Promise<void> {
  const subject = `[Equipment Return Confirmation] ${details.itemName} returned`;
  const text = `Hello ${details.employeeName},\n\nThis is confirmation that the following equipment has been returned and checked back into inventory:\n\n- Item: ${details.itemName}\n- Return Date: ${details.returnedAt}\n${details.notes ? `- Return Notes: ${details.notes}\n` : ''}\nThank you!\n\nBest regards,\nIT & Equipment Inventory Team`;

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
  });
}

export async function notifyRequestStatusChanged(details: {
  to: string;
  requesterName: string;
  category: string;
  status: string;
  notes?: string;
  deviceDetails?: string;
  remarks?: string;
}): Promise<void> {
  const device = details.deviceDetails || details.category;
  let subject = `[Device Request Update] Your request is now ${details.status}`;
  let text = `Hello ${details.requesterName},\n\nYour equipment request for "${details.category}" has been updated to: ${details.status}.\n${details.notes ? `\nReviewer Notes: ${details.notes}\n` : ''}\nBest regards,\nIT & Equipment Inventory Team`;

  if (details.status === 'Approved') {
    subject = `[Request Approved & Assigned] ${device}`;
    text = `Hello ${details.requesterName},\n\nYour request for ${device} has been approved and assigned.\n${details.notes || details.remarks ? `\nRemarks: ${details.notes || details.remarks}\n` : ''}\nPlease collect or check the device in your assigned equipment portal.\n\nBest regards,\nIT & Equipment Inventory Team`;
  } else if (details.status === 'Rejected') {
    const reason = details.remarks || details.notes || 'No specific reason provided';
    subject = `[Request Rejected] ${device}`;
    text = `Hello ${details.requesterName},\n\nYour request for ${device} has been rejected. Reason: ${reason}.\n\nIf you have any questions, please contact your Team Lead or IT Operations.\n\nBest regards,\nIT & Equipment Inventory Team`;
  }

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
  });
}

export async function notifyPasswordChanged(details: {
  to: string;
  name: string;
  empCode: string;
  changedAt?: string;
}): Promise<void> {
  const time = details.changedAt || new Date().toUTCString();
  const subject = '[Security Alert] Your Transsion Account Password Was Changed';
  const text = `Hello ${details.name},\n\nThis is an automated confirmation that your password for the Transsion Inventory Management portal (Employee ID: ${details.empCode}) has been successfully updated.\n\nDate & Time: ${time}\n\nIf you made this change, you can safely disregard this email.\n\nIf you DID NOT change your password, please immediately contact your System Administrator (admin@inventory.internal) to secure your account.\n\nBest regards,\nTranssion IT & Equipment Inventory Team`;

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="background-color: #0284c7; color: white; padding: 16px; border-radius: 6px; text-align: center;">
    <h2 style="margin: 0; font-size: 20px;">🔒 Password Changed Successfully</h2>
  </div>
  <div style="padding: 20px 0; font-size: 14px; line-height: 1.6;">
    <p>Hello <strong>${details.name}</strong>,</p>
    <p>This is an automated security notice confirming that your password for the Transsion Inventory Management portal has been successfully updated.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Employee:</strong> ${details.name} (${details.empCode})</p>
      <p style="margin: 4px 0;"><strong>Account Email:</strong> ${details.to}</p>
      <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${time}</p>
    </div>

    <p style="color: #15803d; font-weight: bold; margin: 16px 0 8px 0;">✔ If you authorized this change, no further action is required.</p>
    
    <div style="margin-top: 16px; padding: 12px; background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; font-size: 13px; color: #991b1b;">
      ⚠️ <strong>Didn't make this change?</strong><br>
      If you did not initiate this change, your credentials may be compromised. Please inform your System Administrator immediately.
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
      Transsion R&D Testing Station • Inventory Management System
    </p>
  </div>
</div>`;

  await sendNotificationEmail({
    to: details.to,
    subject,
    text,
    html,
  });
}

