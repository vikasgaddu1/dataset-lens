"""
Create a test SAS dataset with COUNTRY column for testing IN operator
"""

import pandas as pd
import numpy as np
import os

# Create sample data with COUNTRY column
np.random.seed(42)  # For reproducible results
countries = ['USA', 'CAN', 'IND', 'GBR', 'AUS', 'GER', 'FRA', 'JPN', 'CHN', 'BRA']

data = {
    'ID': range(1, 201),
    'NAME': [f'Person_{i}' for i in range(1, 201)],
    'AGE': np.random.randint(18, 65, 200),
    'SALARY': np.random.randint(30000, 150000, 200),
    'DEPARTMENT': np.random.choice(['Sales', 'Engineering', 'Marketing', 'HR', 'Finance'], 200),
    'CITY': np.random.choice(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'], 200),
    'COUNTRY': np.random.choice(countries, 200),
    'VISITNUM': np.random.randint(1, 10, 200)
}

df = pd.DataFrame(data)

# Display some info
print("Sample Data Created:")
print(f"Total rows: {len(df)}")
print(f"Columns: {', '.join(df.columns)}")
print("\nFirst 10 rows:")
print(df.head(10))

# Country distribution
print("\nCountry distribution:")
print(df['COUNTRY'].value_counts())

# Test various IN conditions
print("\nTest filter results:")
print(f"COUNTRY IN ('USA', 'CAN'): {len(df[df['COUNTRY'].isin(['USA', 'CAN'])])} rows")
print(f"COUNTRY IN ('IND', 'USA', 'GBR'): {len(df[df['COUNTRY'].isin(['IND', 'USA', 'GBR'])])} rows")
print(f"COUNTRY NOT IN ('USA', 'CAN'): {len(df[~df['COUNTRY'].isin(['USA', 'CAN'])])} rows")

# Save as CSV for reference
csv_path = 'test_data_with_country.csv'
df.to_csv(csv_path, index=False)
print(f"\nData saved to: {csv_path}")

# Try to save as SAS if pyreadstat is available
try:
    import pyreadstat

    # Save as SAS7BDAT - use pyreadstat.write_sav then convert, or direct method
    sas_path = 'test_data_with_country.sas7bdat'
    try:
        # Try write_sas7bdat first (newer versions)
        pyreadstat.write_sas7bdat(df, sas_path)
    except AttributeError:
        # Try alternative method - write as xport then read back
        xport_path = 'test_data_temp.xpt'
        pyreadstat.write_xport(df, xport_path, file_label="TEST DATA")
        # Can't directly convert, so just indicate xport file is available
        print(f"Note: Created XPORT file at {xport_path} (SAS7BDAT write not available)")
        sas_path = None

    if sas_path:
        print(f"SAS file saved to: {sas_path}")
        # Verify it can be read back
        df_test, meta = pyreadstat.read_sas7bdat(sas_path)
        print(f"\nVerification: Successfully read back {len(df_test)} rows from SAS file")

except ImportError:
    print("\nNote: pyreadstat not installed. Install with: py -m pip install pyreadstat")
    print("CSV file can still be used for testing")
except Exception as e:
    print(f"\nNote: Could not write SAS file: {e}")
    print("CSV file can still be used for testing")

print("\nYou can now test WHERE clauses like:")
print("  COUNTRY IN ('USA', 'CAN')")
print("  COUNTRY IN ('IND', 'USA', 'GBR')")
print("  COUNTRY NOT IN ('USA', 'CAN')")
print("  AGE > 30 AND COUNTRY IN ('USA', 'CAN')")