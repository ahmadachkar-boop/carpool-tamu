// functions/index.js - FINAL WORKING VERSION
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "logistics.carpool@gmail.com", // CORRECTED - no double 'l'
      pass: "fpmdtudixkqypcih", // Your working password
    },
  });
};

exports.sendApprovalEmail = onDocumentUpdated(
    "emailApprovals/{approvalId}",
    async (event) => {
      console.log("=== FUNCTION TRIGGERED ===");
      console.log("Document ID:", event.params.approvalId);

      try {
        const newData = event.data.after.data();
        const oldData = event.data.before.data();

        console.log("Old status:", oldData?.status);
        console.log("New status:", newData?.status);
        console.log("Email:", newData?.email);
        console.log("Name:", newData?.name);

        // Check if status changed to approved
        if (oldData.status !== "approved" && newData.status === "approved") {
          console.log("✅ Status changed to approved - sending email");

          const transporter = createEmailTransporter();

          const mailOptions = {
            from: "\"TAMU Carpool\" <logistics.carpool@gmail.com>",
            to: newData.email,
            subject: "Your TAMU Carpool Registration is Approved! 🎉",
            text: `Hi ${newData.name || "there"},

Great news! Your email has been approved for TAMU Carpool registration.

You can now create your account at:
https://carpool-tamu-2446c.web.app/register

What's Next?
- Click the link above to complete your registration
- Fill out your profile information
- Start offering or requesting rides

If you have any questions, feel free to reach out to our team.

Gig 'em!
The TAMU Carpool Team`,
            html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #500000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; background-color: #500000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to TAMU Carpool!</h1>
    </div>
    <div class="content">
      <p>Hi ${newData.name || "there"},</p>
      <p>Great news! Your email has been approved for TAMU Carpool registration.</p>
      <p>You can now create your account and start carpooling with fellow Aggies!</p>
      <div style="text-align: center;">
        <a href="https://carpool-tamu-2446c.web.app/register" class="button">Create Your Account</a>
      </div>
      <p><strong>What's Next?</strong></p>
      <ul>
        <li>Click the button above to complete your registration</li>
        <li>Fill out your profile information</li>
        <li>Start offering or requesting rides</li>
      </ul>
      <p>If you have any questions, feel free to reach out to our team.</p>
      <p>Gig 'em! 👍</p>
      <p><strong>The TAMU Carpool Team</strong></p>
    </div>
    <div class="footer">
      <p>This email was sent because your registration was approved by an administrator.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
          };

          console.log("📤 Sending email to:", newData.email);
          const info = await transporter.sendMail(mailOptions);
          console.log("✅ Email sent successfully!");
          console.log("Message ID:", info.messageId);

          return null;
        } else {
          console.log("⏭️  Status didn't change to approved, skipping email");
          return null;
        }
      } catch (error) {
        console.error("❌ ERROR sending email:");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        return null;
      }
    });
