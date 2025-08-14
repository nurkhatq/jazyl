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

    
    # Замените метод send_master_welcome_email на этот исправленный:

    async def send_master_welcome_email(
        self,
        to_email: str,
        master_name: str,
        barbershop_name: str
    ) -> bool:
        """Send welcome email to new master with login instructions"""
        
        # Создаем ссылку без токена, только с email
        set_password_link = f"https://jazyl.tech/set-password?email={to_email}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }}
                .logo {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #000;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 30px;
                    background-color: #000;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .button:hover {{
                    background-color: #333;
                }}
                .info-box {{
                    background-color: #f9f9f9;
                    border-left: 4px solid #000;
                    padding: 15px;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #f0f0f0;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Jazyl</div>
                </div>
                
                <h2>Welcome to {barbershop_name}!</h2>
                
                <p>Hello {master_name},</p>
                
                <p>You have been added as a master at <strong>{barbershop_name}</strong>. To complete your registration and access your dashboard, please set your password.</p>
                
                <div class="info-box">
                    <p><strong>Your login email:</strong> {to_email}</p>
                    <p><strong>Role:</strong> Master</p>
                    <p><strong>Barbershop:</strong> {barbershop_name}</p>
                </div>
                
                <p>Click the button below to set your password:</p>
                
                <div style="text-align: center;">
                    <a href="{set_password_link}" class="button">Set Your Password</a>
                </div>
                
                <p>After setting your password, you can log in at:</p>
                <p><a href="https://jazyl.tech/login">https://jazyl.tech/login</a></p>
                
                <h3>What you can do as a Master:</h3>
                <ul>
                    <li>View and manage your schedule</li>
                    <li>See your upcoming appointments</li>
                    <li>Manage your client notes</li>
                    <li>Track your performance</li>
                </ul>
                
                <p>If you have any questions, please contact your barbershop administrator.</p>
                
                <div class="footer">
                    <p>This email was sent from Jazyl - Barbershop Management Platform</p>
                    <p>© 2025 Jazyl. All rights reserved.</p>
                    <p style="margin-top: 10px;">
                        <small>If you didn't expect this email, please ignore it.</small>
                    </p>
                </div>
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