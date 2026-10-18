import nodemailer from "nodemailer";
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, CONTACT_NOTIFICATION_EMAIL } from "../config/secret";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: Number(SMTP_PORT) === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendOtpEmail(to: string, otp: string, purpose: "registration" | "password reset" = "registration"): Promise<void> {
  const subject = purpose === "password reset" ? "Reset your Themora password" : "Verify your Themora account";
  const text = `Your ${purpose} code is ${otp}. It will expire in 10 minutes.`;
  const html = `<p>Your ${purpose} code is <b>${otp}</b>. It will expire in 10 minutes.</p>`;

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


const frontendUrl = () => (process.env.FRONTEND_URL || "https://themora.vercel.app").replace(/\/+$/, "");

export async function sendProductUpdateEmail(
  to: string,
  name: string,
  product: { title: string; slug: string },
  version: string,
  changelog: string
): Promise<void> {
  const link = `${frontendUrl()}/dashboard/downloads`;
  const summary = changelog.split("\n").filter(Boolean).slice(0, 8);
  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: `${product.title} ${version} is available`,
    text: `Hi ${name},\n\n${product.title} ${version} is ready to download.\n\n${summary.join("\n")}\n\nDownload it from ${link}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p><b>${escapeHtml(product.title)} ${escapeHtml(version)}</b> is ready to download.</p>${
      summary.length ? `<ul>${summary.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s*/, ""))}</li>`).join("")}</ul>` : ""
    }<p><a href="${link}">Download the update</a></p>`,
  });
}

export async function sendRefundDecisionEmail(
  to: string,
  name: string,
  orderNumber: string,
  approved: boolean,
  note?: string | null
): Promise<void> {
  const subject = approved ? `Refund approved for order ${orderNumber}` : `Update on your refund request for order ${orderNumber}`;
  const message = approved
    ? "Your refund has been approved and sent to your original payment method. It can take 5–10 business days to appear."
    : "We reviewed your refund request and are unable to approve it.";
  await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text: `Hi ${name},\n\n${message}${note ? `\n\nNote from our team: ${note}` : ""}`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>${message}</p>${note ? `<p><b>Note from our team:</b> ${escapeHtml(note)}</p>` : ""}`,
  });
}
