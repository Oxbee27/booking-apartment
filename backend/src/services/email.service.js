const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendBookingEmail = async ({
  to,
  subject,
  html,
}) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("Email error:", error);
    throw new Error(error.message);
  }

  return data;
};

module.exports = { sendBookingEmail };
