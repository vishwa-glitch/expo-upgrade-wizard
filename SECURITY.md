# Security Policy


## Reporting a Vulnerability

We take the security of Expo Upgrade Wizard seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Open a Public Issue

Please do not report security vulnerabilities through public GitHub issues.

### 2. Report Privately

Send an email to **expo.upgrade.book@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### 4. Disclosure Policy

- We will acknowledge your report within 48 hours
- We will provide regular updates on our progress
- We will notify you when the vulnerability is fixed
- We will publicly disclose the vulnerability after a fix is released
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using Expo Upgrade Wizard:

### API Keys

- Never commit API keys to version control
- Use `.env` files (already in `.gitignore`)
- Rotate keys regularly
- Use environment-specific keys

### Dependencies

- We regularly update dependencies
- We use `npm audit` in CI/CD
- We monitor security advisories
- We use Dependabot for automated updates

### Code Execution

- The tool modifies your project files
- Always review changes in dry-run mode first
- Always commit your work before running upgrades
- Use the backup feature

### Network Security

- All API calls use HTTPS
- We validate SSL certificates
- We don't transmit sensitive project data
- API keys are never logged

## Known Security Considerations

### File System Access

The tool requires write access to your project directory to:
- Update package.json
- Modify configuration files
- Create backups

This is necessary for the tool's functionality. Always run in a version-controlled directory.

### Backup Files

Backups may contain sensitive information from your project. The `.expo-upgrade-wizard/` directory is in `.gitignore` by default.

## Security Updates

We will announce security updates through:
- GitHub Security Advisories
- Release notes
- npm package updates
- Email notifications (for critical issues)

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate security researchers who responsibly disclose vulnerabilities.

## Contact

For security concerns: **expo.upgrade.book@gmail.com**

For general questions: **expo.upgrade.book@gmail.com**

## Acknowledgments

We thank the following security researchers for their responsible disclosure:

(List will be updated as vulnerabilities are reported and fixed)

---

Last updated: October 30, 2025
