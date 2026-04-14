"""
Create a test SAS dataset with age column for testing WHERE clauses
"""

import pandas as pd
import numpy as np
import os

# Create sample data with age column
data = {
    'ID': range(1, 101),
    'NAME': [f'Person_{i}' for i in range(1, 101)],
    'AGE': np.random.randint(18, 65, 100),
    'SALARY': np.random.randint(30000, 150000, 100),
    'DEPARTMENT': np.random.choice(['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'], 100),
    'CITY': np.random.choice(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'], 100)
}

df = pd.DataFrame(data)

# Display some info
print("Sample Data Created:")
print(f"Total rows: {len(df)}")
print(f"Columns: {', '.join(df.columns)}")
print("\nFirst 10 rows:")
print(df.head(10))

# Age distribution
age_over_30 = df[df['AGE'] > 30]
print(f"\nRows with AGE > 30: {len(age_over_30)}")
print(f"Rows with AGE <= 30: {len(df) - len(age_over_30)}")

# Save as CSV for reference
csv_path = 'test_data_with_age.csv'
df.to_csv(csv_path, index=False)
print(f"\nData saved to: {csv_path}")

# Try to save as SAS if pyreadstat is available
try:
    import pyreadstat

    # Save as SAS7BDAT using write_sas7bdat from pyreadstat
    sas_path = 'test_data_with_age.sas7bdat'
    # Note: pyreadstat may require specific format
    # Try the write function with correct parameters
    try:
        # Some versions use write_sas7bdat, others use different name
        if hasattr(pyreadstat, 'write_sas7bdat'):
            pyreadstat.write_sas7bdat(df, sas_path)
        else:
            # Try alternative method
            print("Note: pyreadstat write function not available in this version")
            print("Creating SAS file using alternative method...")
            # We'll just use the CSV for now
            sas_path = None
    except Exception as e:
        print(f"Could not write SAS file: {e}")
        sas_path = None

    if sas_path:
        print(f"SAS file saved to: {sas_path}")

    # Verify it can be read back
    df_test, meta = pyreadstat.read_sas7bdat(sas_path)
    print(f"\nVerification: Successfully read back {len(df_test)} rows from SAS file")

except ImportError:
    print("\nNote: pyreadstat not installed. Install with: pip install pyreadstat")
    print("CSV file can still be used for testing")

print("\nYou can now test WHERE clauses like:")
print("  AGE > 30")
print("  AGE > 30 AND DEPARTMENT = 'Sales'")
print("  SALARY > 50000 OR CITY = 'New York'")