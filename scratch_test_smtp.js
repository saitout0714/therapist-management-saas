const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function testSmtp() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Test" <noreply@example.com>';

  console.log("SMTP Config:");
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Secure: ${secure}`);
  console.log(`User: ${user}`);
  console.log(`Pass: ${pass ? '****' : 'not defined'}`);

  if (!host || !user || !pass) {
    console.error("Missing SMTP credentials in .env.local.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  try {
    console.log("Verifying connection to SMTP server...");
    await transporter.verify();
    console.log("SMTP connection verified successfully!");

    console.log("Sending a test email to cocoro.rinse@gmail.com...");
    await transporter.sendMail({
      from,
      to: 'cocoro.rinse@gmail.com',
      subject: 'SMTP Local Test',
      text: 'This is a test of the local SMTP config.',
    });
    console.log("Email sent successfully!");

  } catch (error) {
    console.error("SMTP Test failed:", error);
  }
}

testSmtp();
