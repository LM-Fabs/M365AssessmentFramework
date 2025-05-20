# README.md

# M365 Security Assessment Framework

## Overview

The M365 Security Assessment Framework is a web application designed for consultants to evaluate the security posture of Microsoft 365 tenants. This framework provides insights into security metrics, calculates a security score, and offers recommendations based on best practices.

## Features

- **Security Score Calculation**: Automatically calculates a security score based on various metrics.
- **Tenant Health Insights**: Provides insights into the overall health of the tenant.
- **Recommendations**: Offers actionable recommendations to improve security.
- **Historical Comparison**: Allows users to compare results over time and against best practices.

## Project Structure

```
m365-security-assessment
├── src
│   ├── components
│   ├── services
│   ├── utils
│   ├── pages
│   └── types
├── api
│   └── functions
├── .github
│   └── workflows
├── package.json
└── tsconfig.json
```

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd m365-security-assessment
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

## Deployment

This application can be deployed as a static web app on Microsoft Azure. Refer to the `.github/workflows/azure-static-web-apps.yml` for the deployment configuration.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.