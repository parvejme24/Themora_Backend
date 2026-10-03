"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = sendOtpEmail;
exports.sendContactNotification = sendContactNotification;
exports.sendContactReplyEmail = sendContactReplyEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const secret_1 = require("../config/secret");
const transporter = nodemailer_1.default.createTransport({
    host: secret_1.SMTP_HOST,
    port: Number(secret_1.SMTP_PORT) || 587,
    secure: Number(secret_1.SMTP_PORT) === 465,
    auth: secret_1.SMTP_USER && secret_1.SMTP_PASS ? { user: secret_1.SMTP_USER, pass: secret_1.SMTP_PASS } : undefined,
});
async function sendOtpEmail(to, otp, purpose = "registration") {
    const subject = purpose === "password reset" ? "Reset your Themora password" : "Verify your Themora account";
    const text = `Your ${purpose} code is ${otp}. It will expire in 10 minutes.`;
    const html = `<p>Your ${purpose} code is <b>${otp}</b>. It will expire in 10 minutes.</p>`;
    await transporter.sendMail({
        from: secret_1.EMAIL_FROM || secret_1.SMTP_USER,
        to,
        subject,
        text,
        html,
    });
}
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
})[character]);
async function sendContactNotification(contact) {
    const recipient = secret_1.CONTACT_NOTIFICATION_EMAIL || secret_1.SMTP_USER || secret_1.EMAIL_FROM;
    if (!recipient)
        return false;
    const fields = [
        ["Name", contact.fullName],
        ["Email", contact.email],
        ["Company", contact.companyName],
        ["Service", contact.serviceRequired],
        ["Budget", contact.budget],
    ];
    const details = escapeHtml(contact.projectDetails).replace(/\n/g, "<br>");
    await transporter.sendMail({
        from: secret_1.EMAIL_FROM || secret_1.SMTP_USER,
        to: recipient,
        replyTo: contact.email,
        subject: `New Themora contact request from ${contact.fullName}`,
        text: `${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nProject details:\n${contact.projectDetails}`,
        html: `<h2>New contact request</h2><dl>${fields.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl><h3>Project details</h3><p>${details}</p>`,
    });
    return true;
}
async function sendContactReplyEmail(to, name, subject, message) {
    const safeName = escapeHtml(name);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
    await transporter.sendMail({
        from: secret_1.EMAIL_FROM || secret_1.SMTP_USER,
        to,
        subject,
        text: `Hello ${name},\n\n${message}`,
        html: `<p>Hello ${safeName},</p><p>${safeMessage}</p><p>Regards,<br>The Themora team</p>`,
        replyTo: secret_1.EMAIL_FROM || secret_1.SMTP_USER,
        headers: { "X-Themora-Contact-Subject": safeSubject },
    });
}
//# sourceMappingURL=email.js.map