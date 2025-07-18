# Admin Consent User Guide

## For M365 Assessment Framework Customers

### What is Admin Consent?

Admin consent is a security feature in Microsoft 365 that allows Global Administrators to grant permissions to applications on behalf of their entire organization. This is required for the M365 Security Assessment Framework to access your tenant's security data.

### Why Do You Need to Grant Consent?

The M365 Security Assessment Framework needs permission to:
- ✅ Read your organization's security configuration
- ✅ Analyze compliance settings
- ✅ Generate security reports and recommendations
- ✅ Check for security best practices implementation

**Important**: The application only has **read-only** access and cannot make changes to your configuration.

### Step-by-Step Consent Process

#### Step 1: Receive the Consent URL
You'll receive a consent URL from your security assessment provider that looks like:
```
https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize?...
```

#### Step 2: Review Requirements
Before clicking the link, ensure you have:
- ✅ Global Administrator privileges in your Azure AD tenant
- ✅ Authority to grant consent for third-party applications
- ✅ Understanding of what permissions will be granted

#### Step 3: Click the Consent URL
1. Click the provided consent URL
2. You'll be redirected to Microsoft's login page
3. Sign in with your Global Administrator account

#### Step 4: Review Permissions
You'll see a consent screen showing:
- **Application Name**: M365 Security Assessment Framework
- **Publisher**: Your security assessment provider
- **Permissions Requested**: Read access to security data
- **On behalf of**: Your organization

#### Step 5: Grant Consent
1. Review the permissions carefully
2. Click **"Accept"** to grant consent
3. You'll be redirected to a confirmation page

#### Step 6: Confirmation
After successful consent, you'll see:
- ✅ Consent granted successfully
- ✅ Enterprise app registration created
- ✅ Assessment framework can now access your tenant

### What Happens After Consent?

1. **Enterprise App Created**: The M365 Security Assessment Framework is added to your Azure AD as an enterprise application
2. **Permissions Activated**: The application can now read your security configuration
3. **Assessment Ready**: Your security assessment provider can begin analyzing your tenant
4. **No User Assignment Required**: The application works without assigning specific users

### Managing the Application

#### Viewing the Enterprise App
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **Enterprise applications**
3. Search for "M365 Security Assessment Framework"
4. Click on the application to view details

#### Reviewing Permissions
In the enterprise application:
1. Click **Permissions**
2. Review granted permissions
3. See consent status and admin who granted consent

#### Revoking Access (if needed)
To remove the application:
1. In the enterprise application page
2. Click **Properties** 
3. Click **Delete**
4. Confirm deletion

### Security Best Practices

#### Before Granting Consent
- ✅ Verify the consent request is from a trusted security assessment provider
- ✅ Confirm the URL is from login.microsoftonline.com
- ✅ Review the permissions being requested
- ✅ Ensure you have authority to grant organizational consent

#### After Granting Consent
- ✅ Monitor the enterprise application in Azure AD
- ✅ Review assessment reports provided by your security provider
- ✅ Ask questions about any security findings
- ✅ Plan remediation for identified security gaps

### Troubleshooting

#### Common Issues

**"Access Denied" Error**
- Ensure you have Global Administrator privileges
- Try using an incognito/private browser window
- Contact your IT administrator for assistance

**"Application Not Found" Error**
- Verify the consent URL is correct and complete
- Check that the URL hasn't been modified or truncated
- Contact your security assessment provider for a new URL

**"Consent Already Granted" Message**
- The application may already be installed in your tenant
- Check Enterprise applications in Azure AD
- Contact your security assessment provider to confirm status

#### Getting Help

If you encounter issues:
1. **Check Azure AD**: Look for the enterprise application in your tenant
2. **Contact Provider**: Reach out to your security assessment provider
3. **Review Logs**: Check Azure AD sign-in logs for error details
4. **Try Again**: Use a different browser or clear cache

### Frequently Asked Questions

**Q: Is this safe?**
A: Yes, when the consent request comes from a trusted security assessment provider. The application only has read-only access to security data.

**Q: Can the application make changes to my tenant?**
A: No, the application only has read permissions and cannot modify your configuration.

**Q: How long does consent last?**
A: Consent remains valid until you revoke it by deleting the enterprise application.

**Q: Can I see what data is being accessed?**
A: Yes, you can review the permissions in the enterprise application and audit logs in Azure AD.

**Q: Who in my organization can grant this consent?**
A: Only Global Administrators can grant admin consent for the entire organization.

**Q: What if I accidentally granted consent?**
A: You can revoke access by deleting the enterprise application from Azure AD at any time.

### Next Steps After Consent

1. **Confirmation**: You should receive confirmation that consent was successful
2. **Assessment Timeline**: Your security assessment provider will inform you when the analysis is complete
3. **Report Delivery**: You'll receive detailed security reports and recommendations
4. **Follow-up**: Plan to implement recommended security improvements

### Contact Information

If you need assistance with the consent process:
- Contact your security assessment provider
- Reference this guide for troubleshooting steps
- Keep the consent URL for reference

---

**Important**: Only grant consent to applications from trusted providers. Always verify the legitimacy of consent requests before proceeding.
