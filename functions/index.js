// functions/index.js - Updated for automatic account creation
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "logistics.carpool@gmail.com",
      pass: "fpmdtudixkqypcih",
    },
  });
};

// Function to generate a random temporary password
const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Send confirmation email when request is created
exports.sendRequestConfirmation = onDocumentCreated(
    "emailApprovals/{approvalId}",
    async (event) => {
      console.log("=== REQUEST CONFIRMATION TRIGGERED ===");

      try {
        const data = event.data.data();

        // Only send confirmation for pending requests
        if (data.status !== "pending") {
          console.log("Not a pending request, skipping confirmation email");
          return null;
        }

        console.log("Sending confirmation to:", data.email);

        const transporter = createEmailTransporter();

        const mailOptions = {
          from: "\"TAMU Carpool\" <logistics.carpool@gmail.com>",
          to: data.email,
          subject: "Registration Request Received - TAMU Carpool",
          text: `Hi ${data.name || "there"},

Thank you for your interest in TAMU Carpool!

We've received your registration request and it's currently pending administrator approval. 

What happens next:
- Your request will be reviewed by an administrator (typically within 24-48 hours)
- Once approved, you'll receive another email with your temporary password
- You'll then be able to log in and complete your profile

If you have any questions, feel free to contact our team.

Gig 'em!
The TAMU Carpool Team`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #79F200; color: #000; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .info-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 Registration Request Received</h1>
    </div>
    <div class="content">
      <p>Hi ${data.name || "there"},</p>
      <p>Thank you for your interest in TAMU Carpool!</p>
      <p>We've received your registration request and it's currently <strong>pending administrator approval</strong>.</p>
      
      <div class="info-box">
        <strong>⏰ What happens next:</strong>
        <ul>
          <li>Your request will be reviewed by an administrator (typically within 24-48 hours)</li>
          <li>Once approved, you'll receive another email with your temporary password</li>
          <li>You'll then be able to log in and complete your profile</li>
        </ul>
      </div>
      
      <p>If you have any questions, feel free to contact our team.</p>
      <p>Gig 'em! 👍</p>
      <p><strong>The TAMU Carpool Team</strong></p>
    </div>
    <div class="footer">
      <p>This email was sent because you requested to register for TAMU Carpool.</p>
    </div>
  </div>
</body>
</html>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Confirmation email sent successfully!");
        console.log("Message ID:", info.messageId);

        return null;
      } catch (error) {
        console.error("❌ ERROR sending confirmation email:");
        console.error("Message:", error.message);
        return null;
      }
    });

// Create account and send credentials when approved
exports.createAccountOnApproval = onDocumentUpdated(
    "emailApprovals/{approvalId}",
    async (event) => {
      console.log("=== APPROVAL FUNCTION TRIGGERED ===");

      try {
        const newData = event.data.after.data();
        const oldData = event.data.before.data();

        console.log("Old status:", oldData?.status);
        console.log("New status:", newData?.status);

        // Check if status changed to approved
        if (oldData.status !== "approved" && newData.status === "approved") {
          console.log("✅ Status changed to approved - creating account");
          await createAccountAndSendEmail(newData);
          return null;
        } else {
          console.log("⏭️ Status didn't change to approved, skipping");
          return null;
        }
      } catch (error) {
        console.error("❌ ERROR in approval process:");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        return null;
      }
    });

// NEW: Handle pre-approvals (documents created already approved)
exports.handlePreApproval = onDocumentCreated(
    "emailApprovals/{approvalId}",
    async (event) => {
      console.log("=== PRE-APPROVAL CHECK TRIGGERED ===");

      try {
        const data = event.data.data();

        console.log("Document created with status:", data.status);
        console.log("Email:", data.email);
        console.log("Pre-approved flag:", data.preApproved);

        // Check if this is a pre-approved entry
        if (data.status === "approved" && data.preApproved === true) {
          console.log("✅ Pre-approved entry detected - creating account");
          await createAccountAndSendEmail(data);
          return null;
        } else if (data.status === "pending") {
          console.log("📧 Pending request - sending confirmation email");
          // Send confirmation email (handled by sendRequestConfirmation)
          return null;
        } else {
          console.log("⏭️ Not a pre-approval, skipping");
          return null;
        }
      } catch (error) {
        console.error("❌ ERROR in pre-approval handler:");
        console.error("Message:", error.message);
        return null;
      }
    });

// Helper function to create account and send email (DRY principle)
/**
 * Creates a Firebase Auth account and Firestore member document,
 * then sends credentials email to the user
 * @param {Object} data - The email approval data
 * @return {Promise<void>}
 */
async function createAccountAndSendEmail(data) {
  const email = data.email;
  const name = data.name;
  const gender = data.gender || "Not specified";

  // Generate temporary password
  const tempPassword = generateTempPassword();
  console.log("Generated temporary password");

  // Create Firebase Auth user
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: email,
      password: tempPassword,
      displayName: name,
    });
    console.log("✅ Firebase Auth user created:", userRecord.uid);
  } catch (authError) {
    if (authError.code === "auth/email-already-exists") {
      console.log("User already exists in Auth, fetching existing user");
      userRecord = await admin.auth().getUserByEmail(email);
      // Update password for existing user
      await admin.auth().updateUser(userRecord.uid, {
        password: tempPassword,
      });
    } else {
      throw authError;
    }
  }

  // Create Firestore member document
  await admin.firestore().collection("members").doc(userRecord.uid).set({
    name: name,
    email: email,
    gender: gender,
    role: "member",
    points: 0,
    nightsWorked: 0,
    phoneRoomShifts: 0,
    tempPassword: true,
    profileCompleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✅ Firestore member document created");

  // Send email with temporary password
  const transporter = createEmailTransporter();

  const mailOptions = {
    from: "\"TAMU Carpool\" <logistics.carpool@gmail.com>",
    to: email,
    subject: "Your TAMU Carpool Account is Ready! 🎉",
    text: `Hi ${name || "there"},

Great news! Your registration has been approved and your account has been created.

Your Login Credentials:
Email: ${email}
Temporary Password: ${tempPassword}

IMPORTANT: For security reasons, you will be required to change your password and complete your profile when you first log in.

Log in now at:
https://carpool-tamu-2446c.web.app/login

What's Next:
1. Log in using the credentials above
2. Change your temporary password
3. Complete your profile information
4. Start offering or requesting rides!

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
    .credentials { background-color: #fff; border: 2px solid #79F200; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background-color: #79F200; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to TAMU Carpool!</h1>
    </div>
    <div class="content">
      <p>Hi ${name || "there"},</p>
      <p>Great news! Your registration has been <strong>approved</strong> and your account has been created.</p>
      
      <div class="credentials">
        <h3 style="margin-top: 0;">🔐 Your Login Credentials</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${tempPassword}</code></p>
      </div>

      <div class="warning">
        <strong>⚠️ IMPORTANT:</strong> For security reasons, you will be required to change your password and complete your profile when you first log in.
      </div>

      <div style="text-align: center;">
        <a href="https://carpool-tamu-2446c.web.app/login" class="button">Log In Now</a>
      </div>

      <p><strong>What's Next:</strong></p>
      <ol>
        <li>Log in using the credentials above</li>
        <li>Change your temporary password</li>
        <li>Complete your profile information</li>
        <li>Start offering or requesting rides!</li>
      </ol>
      
      <p>If you have any questions, feel free to contact our team.</p>
      <p>Gig 'em! 👍</p>
      <p><strong>The TAMU Carpool Team</strong></p>
    </div>
    <div class="footer">
      <p>This email was sent because your registration was approved by an administrator.</p>
      <p><strong>Please keep this email secure as it contains your temporary password.</strong></p>
    </div>
  </div>
</body>
</html>`,
  };

  console.log("📤 Sending approval email to:", email);
  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Approval email sent successfully!");
  console.log("Message ID:", info.messageId);
}
