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
m365-assessment-framework
├── src
│   ├── components
│   ├── hooks
│   ├── models
│   ├── pages
│   ├── services
│   ├── utils
│   ├── App.tsx
│   └── index.tsx
├── api
│   ├── GetAssessment
│   ├── GetBestPractices
│   ├── SaveAssessment
│   └── shared
├── .github
│   └── workflows
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/m365-assessment-framework.git
   cd m365-assessment-framework
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

## API Endpoints

- **GetAssessment**: Retrieve assessment data for a specific tenant.
- **GetBestPractices**: Fetch best practices for security configurations.
- **SaveAssessment**: Save assessment results to the database.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.