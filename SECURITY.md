# Security Policy

## Supported Versions

We actively support the latest version of Autovariant AI. Security updates and patches are provided for:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it to us responsibly.

### How to Report

**Email:** buraksavsar19@gmail.com  
**Subject:** Security Vulnerability Report - Autovariant AI

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Response Time:** We will acknowledge your report within 48 hours
- **Update Time:** We will provide updates on the status of the vulnerability within 7 days
- **Resolution:** We will work to resolve critical vulnerabilities as quickly as possible

### Disclosure Policy

- **Do NOT** publicly disclose the vulnerability until we have addressed it
- We will credit you (if desired) when the vulnerability is fixed
- We will notify you when the vulnerability has been resolved

## Security Best Practices

### For Users

- Keep your Shopify app updated to the latest version
- Use strong, unique passwords for your Shopify account
- Regularly review app permissions
- Monitor your store for unusual activity

### For Developers

- Never commit API keys or secrets to version control
- Use environment variables for sensitive configuration
- Keep dependencies up to date
- Follow secure coding practices
- Regularly audit third-party dependencies

## Security Measures

### Data Protection

- All API tokens are encrypted at rest
- Data transmission uses HTTPS/TLS encryption
- Session data is securely stored
- Regular security audits of our infrastructure

### Access Control

- OAuth 2.0 authentication with Shopify
- Scope-based permissions (only requested scopes are used)
- No unauthorized access to store data
- Automatic session expiration

### Infrastructure

- Secure cloud hosting (Railway, Heroku, or similar)
- Regular security updates and patches
- Monitoring and logging for suspicious activity
- Backup and disaster recovery procedures

## Known Security Considerations

### Third-Party Services

Our app uses the following third-party services:
- **Shopify APIs:** Secure OAuth 2.0 authentication
- **OpenAI API:** Images processed but not stored permanently
- **Hosting Provider:** Industry-standard security measures

### Data Handling

- We only access data necessary for app functionality
- Product data is processed but not stored longer than necessary
- User data is deleted when the app is uninstalled
- We comply with GDPR, CCPA, and other privacy regulations

## Security Updates

We regularly update our app to address security vulnerabilities. Users are encouraged to:
- Keep the app updated to the latest version
- Review release notes for security updates
- Report any security concerns immediately

## Contact

For security-related questions or concerns:
**Email:** buraksavsar19@gmail.com

---

**Last Updated:** November 2024
