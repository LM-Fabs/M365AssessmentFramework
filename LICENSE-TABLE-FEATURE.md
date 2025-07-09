# License Table View Feature

## Overview
Added a comprehensive table view for license data in the M365 Assessment Framework Reports page. This complements the existing chart view and provides detailed license information in a structured table format.

## Features Added

### 1. View Toggle
- Added toggle buttons in the License Management tab header
- Users can switch between "Charts" and "Table" views
- Toggle only appears on the license tab when data is available

### 2. License Table
- **Columns:**
  - License Type: Formatted license name (cleaned up SKU names)
  - Used: Number of assigned licenses
  - Free: Number of available licenses (Total - Used)
  - Total: Total number of licenses
  - Utilization: Visual progress bar with percentage

- **Features:**
  - Responsive design that works on mobile devices
  - Color-coded utilization bars:
    - Green: < 60% utilization
    - Orange: 60-79% utilization  
    - Red: 80%+ utilization
  - Hover effects for better UX
  - Alternating row colors for readability
  - Proper number formatting with commas

### 3. Styling
- Modern, clean table design
- Consistent with existing UI theme
- Responsive breakpoints for mobile devices
- Smooth transitions and hover effects

## Technical Implementation

### Files Modified
1. **src/pages/Reports.tsx**
   - Added `licenseViewMode` state
   - Added `renderLicenseTable()` function
   - Added view toggle controls
   - Modified chart rendering logic to conditionally show table

2. **src/pages/Reports.css**
   - Added complete styling for table view
   - Added view toggle button styles
   - Added responsive media queries

### Key Functions
- `renderLicenseTable(licenseTypes)`: Renders the license data as a table
- View toggle controls integrated into tab header
- Conditional rendering based on `licenseViewMode` state

## Usage
1. Navigate to Reports page
2. Select a customer with license data
3. Go to "License Management" tab
4. Use the "📊 Charts" / "📋 Table" toggle to switch views
5. In table view, see detailed license breakdown with utilization metrics

## Data Processing
- Uses existing license data processing logic
- Calculates free licenses as (Total - Used)
- Computes utilization percentage for visual indicators
- Handles edge cases with proper fallbacks
- Formats license names for better readability

## Benefits
- Detailed view of license allocation
- Easy comparison between different license types
- Visual utilization indicators for quick assessment
- Export-friendly format (users can copy table data)
- Better accessibility compared to charts
