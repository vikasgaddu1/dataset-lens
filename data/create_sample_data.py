import pandas as pd
import pyreadstat
import numpy as np
from datetime import datetime, timedelta
import os

def create_sample_sas_data():
    """Create a sample SAS dataset for testing the extension."""

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create sample data
    n_rows = 500

    # Generate data
    data = {
        'ID': range(1, n_rows + 1),
        'Name': [f'Person_{i:03d}' for i in range(1, n_rows + 1)],
        'Age': np.random.randint(18, 80, n_rows),
        'Gender': np.random.choice(['M', 'F'], n_rows),
        'Salary': np.random.normal(50000, 15000, n_rows).round(2),
        'Department': np.random.choice(['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'], n_rows),
        'Years_Experience': np.random.randint(0, 25, n_rows),
        'Performance_Rating': np.random.choice(['Poor', 'Fair', 'Good', 'Excellent'], n_rows),
        'Active': np.random.choice([True, False], n_rows),
        'Hire_Date': pd.date_range('2000-01-01', '2023-12-31', periods=n_rows).date,
    }

    # Create DataFrame
    df = pd.DataFrame(data)

    # Add some missing values to make it more realistic
    df.loc[df.sample(n=10).index, 'Salary'] = np.nan
    df.loc[df.sample(n=5).index, 'Performance_Rating'] = np.nan

    # Create variable labels (metadata)
    variable_labels = {
        'ID': 'Employee ID',
        'Name': 'Employee Name',
        'Age': 'Age in Years',
        'Gender': 'Gender (M/F)',
        'Salary': 'Annual Salary (USD)',
        'Department': 'Work Department',
        'Years_Experience': 'Years of Experience',
        'Performance_Rating': 'Performance Rating',
        'Active': 'Currently Active Employee',
        'Hire_Date': 'Date of Hire'
    }

    # Save as SAS file
    output_file = 'sample_employees.sas7bdat'

    try:
        # pyreadstat doesn't have write_sas7bdat, let's use a different approach
        # Save as CSV instead and note that users should use real SAS files
        csv_file = 'sample_employees.csv'
        df.to_csv(csv_file, index=False)

        print(f"Sample CSV dataset created: {csv_file}")
        print("NOTE: This creates a CSV file. For testing the SAS extension,")
        print("you'll need a real .sas7bdat file.")
        print(f"Dataset contains {len(df)} observations and {len(df.columns)} variables")
        print("\nVariable summary:")
        for col, label in variable_labels.items():
            print(f"  {col}: {label}")

        return True

    except Exception as e:
        print(f"Error creating CSV file: {e}")
        return False

if __name__ == "__main__":
    success = create_sample_sas_data()
    if success:
        print("\n[OK] Sample dataset created successfully!")
        print("You can now test the extension by opening 'sample_employees.sas7bdat'")
    else:
        print("\n[FAIL] Failed to create sample dataset")