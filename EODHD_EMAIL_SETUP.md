# EODHD Nightly Build - Email Notifications Setup

Get email reports after each nightly build run with progress updates and completion notifications.

## Quick Setup

### 1. Enable Email Notifications

Add these variables to your `.env` file:

```bash
# Copy from example
cat .env.email.example >> .env

# Or create manually
echo "EODHD_EMAIL_ENABLED=true" >> .env
echo "EODHD_EMAIL_TO=your-email@gmail.com" >> .env
echo "EODHD_SMTP_PASSWORD=your-app-password" >> .env
```

### 2. Get Gmail App Password

#### **Option A: Using Google Account (Recommended)**

1. Go to: https://myaccount.google.com/apppasswords
2. Select app: **"Mail"**
3. Select device: **"Other"** (enter "EODHD Nightly Build")
4. Click **"Generate"**
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
6. Add to `.env`:
   ```bash
   EODHD_SMTP_PASSWORD=abcdefghijklmnop
   ```

**Note:** 2-factor authentication must be enabled

#### **Option B: Using Outlook/Hotmail**

```bash
EODHD_SMTP_SERVER=smtp-mail.outlook.com
EODHD_SMTP_PORT=587
EODHD_SMTP_USERNAME=your-email@outlook.com
EODHD_SMTP_PASSWORD=your-regular-password
```

#### **Option C: Using Yahoo**

```bash
EODHD_SMTP_SERVER=smtp.mail.yahoo.com
EODHD_SMTP_PORT=587
EODHD_SMTP_USERNAME=your-email@yahoo.com
EODHD_SMTP_PASSWORD=your-app-password
```

Generate Yahoo App Password: https://login.yahoo.com/account/security

### 3. Test Email Configuration

```bash
python3 -c "
import os
os.environ['EODHD_EMAIL_ENABLED'] = 'true'
os.environ['EODHD_EMAIL_TO'] = 'your-email@gmail.com'
os.environ['EODHD_SMTP_PASSWORD'] = 'your-app-password'

from build_eodhd_nightly import send_email
send_email('Test Email', 'This is a test from EODHD nightly build system.')
"
```

If successful, you'll see: `📧 Email sent to your-email@gmail.com`

## Email Content

You'll receive an email after each nightly run with:

### Nightly Report

```
Subject: EODHD Nightly Build Report - 50/500 Complete

EODHD Options Dataset - Nightly Build Report
============================================================

Date: 2025-10-13 02:15:32

Tonight's Results:
  ✅ Successful: 48 tickers
  ❌ Failed: 2 tickers
  📞 API Calls: 45,678

Overall Progress:
  Completed: 50/500 tickers (10.0%)
  Failed: 2 tickers
  Remaining: 448 tickers

  Total API Calls Used: 45,678
  Total Contracts: 5,000,000

Estimated nights remaining: 9
```

### Completion Notification

```
Subject: ✅ EODHD Dataset Build COMPLETE

EODHD Options Dataset - Nightly Build Report
============================================================

Date: 2025-10-22 02:15:32

Tonight's Results:
  ✅ Successful: 50 tickers
  ❌ Failed: 0 tickers
  📞 API Calls: 48,234

Overall Progress:
  Completed: 500/500 tickers (100.0%)
  Failed: 2 tickers
  Remaining: 0 tickers

  Total API Calls Used: 456,789
  Total Contracts: 450,000,000

🎉 DATASET BUILD COMPLETE! 🎉

All tickers processed successfully.
```

## Configuration Options

### Full .env Configuration

```bash
# Enable/disable email
EODHD_EMAIL_ENABLED=true

# Email addresses
EODHD_EMAIL_TO=your-email@gmail.com
EODHD_EMAIL_FROM=your-email@gmail.com

# SMTP server (Gmail example)
EODHD_SMTP_SERVER=smtp.gmail.com
EODHD_SMTP_PORT=587

# Credentials
EODHD_SMTP_USERNAME=your-email@gmail.com
EODHD_SMTP_PASSWORD=your-app-password
```

### Multiple Recipients

To send to multiple email addresses, use a comma-separated list:

```bash
EODHD_EMAIL_TO=email1@gmail.com,email2@gmail.com,email3@gmail.com
```

## Troubleshooting

### "No SMTP password configured"

Make sure `EODHD_SMTP_PASSWORD` is set in your `.env` file.

### "Authentication failed"

**For Gmail:**
- Verify 2FA is enabled on your Google account
- Use an App Password, not your regular password
- Remove spaces from the app password

**For other providers:**
- Check your username and password
- Verify SMTP server and port are correct

### "Connection refused"

- Check your firewall settings
- Verify SMTP server and port
- Try port 465 (SSL) instead of 587 (TLS)

### "Email not received"

- Check spam/junk folder
- Verify email address in `EODHD_EMAIL_TO`
- Check the log file for errors: `tail -f data/eodhd_options/nightly_build.log`

## Disable Email Notifications

Set to `false` or remove from `.env`:

```bash
EODHD_EMAIL_ENABLED=false
```

## Security Notes

- **Never commit `.env` file to git** (already in `.gitignore`)
- Use App Passwords, not regular passwords
- Keep SMTP credentials secure
- Only share `.env.email.example`, never your actual `.env`

## Manual Test

To manually test the nightly script with email:

```bash
# Set email config in .env first, then run:
python3 build-eodhd-nightly.py
```

Check your inbox for the report!

## Alternative: Use System Mail Command

If you prefer using system mail instead of SMTP:

Edit `build-eodhd-nightly.py` and replace the `send_email` function:

```python
def send_email(subject, body):
    """Send email using system mail command"""
    if not EMAIL_ENABLED:
        return

    try:
        import subprocess
        subprocess.run(
            ['mail', '-s', subject, EMAIL_TO],
            input=body.encode(),
            check=True
        )
        log(f"📧 Email sent to {EMAIL_TO}")
    except Exception as e:
        log(f"❌ Failed to send email: {str(e)}")
```

## Support

**Gmail Help:** https://support.google.com/accounts/answer/185833
**Outlook Help:** https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353
**Yahoo Help:** https://help.yahoo.com/kb/SLN4075.html

---

**You're all set!** You'll now receive email updates after each nightly run. 📧
