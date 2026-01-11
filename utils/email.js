/**
 * Email Service using Nodemailer
 */

import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const createTransporter = () => {
  // For development, use Gmail or other SMTP service
  // For production, configure with your email service credentials
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Generate OTP email template
 */
const getOTPEmailTemplate = (otp, eventTitle) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px; text-align: center;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Verify Your Email</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Thank you for your interest in <strong>${eventTitle}</strong>!
              </p>
              <p style="margin: 0 0 30px; color: #666666; font-size: 14px; line-height: 1.6;">
                Please use the verification code below to confirm your email address and get your tickets:
              </p>
              
              <!-- OTP Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 10px; color: #ffffff; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 6px; padding: 20px; margin: 15px 0; display: inline-block;">
                  <p style="margin: 0; color: #667eea; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</p>
                </div>
                <p style="margin: 15px 0 0; color: #ffffff; font-size: 12px; opacity: 0.9;">This code will expire in 10 minutes</p>
              </div>
              
              <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Sydney Events. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Send OTP email
 */
export const sendOTPEmail = async (email, otp, eventTitle) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured. Email sending disabled.');
      // In development, log the OTP instead
      logger.info('OTP for email verification', { email, otp, eventTitle });
      return { success: true, message: 'OTP logged (SMTP not configured)' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Sydney Events" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Verify Your Email - ${eventTitle}`,
      html: getOTPEmailTemplate(otp, eventTitle),
      text: `Your verification code for ${eventTitle} is: ${otp}. This code will expire in 10 minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('OTP email sent successfully', { email, messageId: info.messageId });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending OTP email', { error: error.message, email });
    throw error;
  }
};

