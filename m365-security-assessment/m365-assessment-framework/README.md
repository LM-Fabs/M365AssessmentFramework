# Microsoft 365 Security Assessment Framework

## Overview

The Microsoft 365 Security Assessment Framework is a web application designed for consultants to evaluate the security posture of Microsoft 365 tenants. It provides tools to compare security metrics, calculate security scores, and offer insights and recommendations for improving tenant health.

## Features

- **Assessment Submission**: Users can submit security assessments through a user-friendly form.
- **Metrics Comparison**: Compare security metrics across different tenants to identify strengths and weaknesses.
- **Security Score Visualization**: Visual representation of the overall security score for each tenant.
- **Recommendations**: Generate actionable recommendations based on assessment results.
- **Historical Data**: View the history of assessments to track improvements over time.

## Project Structure

```
m365-security-assessment/
└── m365-assessment-framework/
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── models/
    │   ├── pages/
    │   ├── services/
    │   ├── shared/
    │   ├── types/
    │   ├── utils/
    │   ├── App.tsx
    │   └── index.tsx
    ├── api/
    │   ├── CreateEnterpriseApp/
    │   ├── GetAssessment/
    │   ├── GetBestPractices/
    │   ├── SaveAssessment/
    │   ├── ValidateKeyVault/
    │   └── shared/
    ├── public/
    ├── build/
    ├── package.json
    ├── tsconfig.json
    ├── staticwebapp.config.json
    ├── swa-cli.config.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── README.md
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/M365AssessmentFramework.git
   cd M365AssessmentFramework/m365-security-assessment/m365-assessment-framework
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the correct Node.js version (if needed):
   ```bash
   cd ../
   ./setup-env.sh
   cd m365-assessment-framework
   ```

4. Run the application (frontend and API together):
   ```bash
   npm run dev
   ```

   - This will start both the React frontend and the Azure Functions API locally.

## API Endpoints

- **GetAssessment**: Retrieve assessment data for a specific tenant.
- **GetBestPractices**: Fetch best practices for security configurations.
- **SaveAssessment**: Save assessment results to the database.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.