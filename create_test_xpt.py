"""
Create a test XPT file that works with the extension
Uses pyreadstat to create a simple XPT file
"""

import pandas as pd
import pyreadstat

# Create a simple test dataset
data = {
    'ID': [1, 2, 3, 4, 5],
    'Name': ['Alice', 'Bob', 'Charlie', 'David', 'Eve'],
    'Age': [25, 30, 35, 40, 45],
    'Score': [85.5, 92.0, 78.5, 88.0, 95.5],
    'Status': ['Active', 'Active', 'Inactive', 'Active', 'Active']
}

df = pd.DataFrame(data)

# Save as XPT file using pyreadstat
output_file = 'test_simple.xpt'

# Create variable labels
column_labels = {
    'ID': 'Subject ID',
    'Name': 'Subject Name',
    'Age': 'Age in Years',
    'Score': 'Test Score',
    'Status': 'Enrollment Status'
}

pyreadstat.write_xport(df, output_file, column_labels=column_labels, table_name='TESTDATA')

print(f"Created {output_file} successfully!")
print(f"\nDataset info:")
print(f"- Rows: {len(df)}")
print(f"- Columns: {len(df.columns)}")
print(f"- Variables: {list(df.columns)}")
print(f"\nFirst few rows:")
print(df.head())
