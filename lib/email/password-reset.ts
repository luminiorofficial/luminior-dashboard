import "server-only";
import nodemailer from "nodemailer";

function mailConfig() {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS;
  const port = Number(process.env.MAIL_PORT);

  if (!host || !user || !pass || !Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP environment variables are not configured");
  }

  return { host, user, pass, port };
}

export async function sendPasswordResetOtp(email: string, otp: string) {
  const config = mailConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transporter.sendMail({
  from: process.env.MAIL_FROM?.trim() || config.user,
  to: email,
  subject: "Your Luminior password reset code",
  text: `Your Luminior password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b">
      <h2>Reset your Luminior password</h2>
      <p>Use this one-time code to continue:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${otp}</p>
      <p>This code expires in 10 minutes and can only be used once.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `,
});

console.log("PASSWORD RESET MAIL:", {
  messageId: info.messageId,
  accepted: info.accepted,
  rejected: info.rejected,
  response: info.response,
});
}
