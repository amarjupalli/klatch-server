import nodemailer from "nodemailer";
import { MAILER } from "../config";

export async function sendEmail(to: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: MAILER.TEST_USER, // generated ethereal user
      pass: MAILER.TEST_PASS, // generated ethereal password
    },
  });

  const info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>', // sender address
    to, // list of receivers
    subject: "Change password ✔", // Subject line
    html,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}
