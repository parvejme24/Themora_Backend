import nodemailer from "nodemailer";
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, CONTACT_NOTIFICATION_EMAIL } from "../config/secret";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: false,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = "Your OTP Code";
  const text = `Your OTP code is ${otp}. It will expire in 10 minutes.`;
  const html = `<p>Your OTP code is <b>${otp}</b>. It will expire in 10 minutes.</p>`;

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);

export async function sendContactNotification(contact: {
  fullName: string;
  email: string;
  companyName: string;
  serviceRequired: string;
  budget: string;
  projectDetails: string;
}): Promise<boolean> {
  const recipient = CONTACT_NOTIFICATION_EMAIL || SMTP_USER || EMAIL_FROM;
  if (!recipient) return false;

  const fields = [
    ["Name", contact.fullName],
    ["Email", contact.email],
    ["Company", contact.companyName],
    ["Service", contact.serviceRequired],
    ["Budget", contact.budget],
  ] as const;
  const details = escapeHtml(contact.projectDetails).replace(/\n/g, "<br>");

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to: recipient,
    replyTo: contact.email,
    subject: `New Themora contact request from ${contact.fullName}`,
    text: `${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nProject details:\n${contact.projectDetails}`,
    html: `<h2>New contact request</h2><dl>${fields.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl><h3>Project details</h3><p>${details}</p>`,
  });

  return true;
}

export async function sendContactReplyEmail(to: string, name: string, subject: string, message: string): Promise<void> {
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text: `Hello ${name},\n\n${message}`,
    html: `<p>Hello ${safeName},</p><p>${safeMessage}</p><p>Regards,<br>The Themora team</p>`,
    replyTo: EMAIL_FROM || SMTP_USER,
    headers: { "X-Themora-Contact-Subject": safeSubject },
  });
}

