import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Environment, FileSystemLoader
from typing import Optional
import os

from app.config import settings

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        
        # Setup Jinja2 for email templates
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates', 'emails')
        self.env = Environment(loader=FileSystemLoader(template_dir))
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False
    
    async def send_verification_email(
        self,
        to_email: str,
        user_name: str,
        verification_token: str
    ) -> bool:
        template = self.env.get_template('verification.html')
        
        verification_link = f"https://api.jazyl.tech/api/auth/verify-email/{verification_token}"

        
        html_content = template.render(
            user_name=user_name,
            verification_link=verification_link
        )
        
        return await self.send_email(
            to_email=to_email,
            subject="Verify your Jazyl account",
            html_content=html_content
        )
    
    async def send_password_reset(
        self,
        to_email: str,
        user_name: str,
        reset_token: str
    ) -> bool:
        template = self.env.get_template('password_reset.html')
        
        reset_link = f"https://jazyl.tech/reset-password/{reset_token}"
        
        html_content = template.render(
            user_name=user_name,
            reset_link=reset_link
        )
        
        return await self.send_email(
            to_email=to_email,
            subject="Reset your Jazyl password",
            html_content=html_content
        )

    async def send_master_welcome_email(
        self,
        to_email: str,
        master_name: str,
        barbershop_name: str
    ) -> bool:
        """Send welcome email to new master with login instructions"""
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Welcome to {barbershop_name} on Jazyl!</h2>
                
                <p>Hello {master_name},</p>
                
                <p>You have been added as a master at {barbershop_name}. Your account has been created with the following email:</p>
                
                <p><strong>Email:</strong> {to_email}</p>
                
                <p>To complete your registration and set your password, please click the link below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://jazyl.tech/set-password?email={to_email}" 
                    style="background-color: #000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Set Your Password
                    </a>
                </div>
                
                <p>After setting your password, you can log in to your dashboard at:</p>
                <p><a href="https://jazyl.tech/login">https://jazyl.tech/login</a></p>
                
                <p>If you have any questions, please contact your barbershop administrator.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                
                <p style="color: #666; font-size: 12px;">
                    This email was sent from Jazyl - Barbershop Management Platform<br>
                    © 2025 Jazyl. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_email=to_email,
            subject=f"Welcome to {barbershop_name} - Set Your Password",
            html_content=html_content
        )
    async def send_booking_confirmation(self, **kwargs) -> bool:
        template = self.env.get_template('booking_confirmation.html')
        html_content = template.render(**kwargs)
        
        return await self.send_email(
            to_email=kwargs['to_email'],
            subject=f"Booking Confirmation - {kwargs['barbershop_name']}",
            html_content=html_content
        )
    
    async def send_booking_reminder(self, **kwargs) -> bool:
        template = self.env.get_template('booking_reminder.html')
        html_content = template.render(**kwargs)
        
        return await self.send_email(
            to_email=kwargs['to_email'],
            subject=f"Reminder: Your appointment at {kwargs['barbershop_name']}",
            html_content=html_content
        )
    
    async def send_booking_cancellation(self, **kwargs) -> bool:
        template = self.env.get_template('booking_cancellation.html')
        html_content = template.render(**kwargs)
        
        return await self.send_email(
            to_email=kwargs['to_email'],
            subject=f"Booking Cancelled - {kwargs['barbershop_name']}",
            html_content=html_content
        )